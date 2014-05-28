// node-hirelings
// ==============
//
// node-hirelings is a lightweight work queue using child processes and events. 
//
// License
// -------
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at http://mozilla.org/MPL/2.0/.
//
var util = require('util'),
    child_process = require('child_process'),
    events = require('events'),
    _ = require('underscore');

// Pool
// ----
//
// A instance of Pool manages a pool of processes. Jobs can be enqueued and
// tasked to processes. When all the processes in the pool are busy, Jobs are
// kept in a FIFO backlog.
function Pool (options) {
    var self = this;
    
    events.EventEmitter.call(this);

    this.id = _.uniqueId('pool-');
    this.options = _.defaults(options || {}, Pool.DEFAULT_OPTIONS);
    this.enqueue_ct = 0;
    this.jobs_ct = 0;
    this.backlog = [];
    this.worker_processes = {};
    this.respawn_workers = true;
}

// ### Options
//
Pool.DEFAULT_OPTIONS = {
    // * `max_processes` - Max number of worker processes allowed to spawn
    max_processes: Math.ceil(require('os').cpus().length * 1.25),
    // * `max_jobs_per_process` - Max number of jobs allowed per worker before
    // it self-destructs
    max_jobs_per_process: 64,
    // * `retries` - Number of times a failed job will be retried before
    // reporting failure
    retries: 0,
    // * `respawn_wait` - time to wait until attempting to respawn a worker
    // after it exits
    respawn_wait: 1000,

    // #### Timeouts
    // 
    // Worker processes are allowed to spend a limited amount of time in
    // various states before moving on. If this time is exceeded, the Pool will
    // kill the process, assuming that the worker has become unresponsive.
    
    // * `timeout_initializing` - Timeout while the process initializes
    timeout_initializing: 5000,
    // * `timeout_working` - Timeout while process works on a job
    timeout_working: 10000,
    // * `timeout_recovering` - Timeout while process recovers after a job
    timeout_recovering: 5000
};

// ### Events
//
// A Pool instance offers several events to which handlers can listen. These
// are mostly useful for monitoring the activity of the Pool, and aren't
// necessary for getting work done.
//
// * `ready` - the process pool is full and ready for jobs
// * `spawn (Process)` - a Process has been spawned
// * `exit (Process)` - a Process has exited
// * `task (job, process)` - a Process has been tasked with a Job
// * `backlog (job)` - a Job has been queued into the backlog
// * `done (job)` - a Job has been completed (success or error)
// * `idle` - the backlog has been drained and all Processes are idle
util.inherits(Pool, events.EventEmitter);

_.extend(Pool.prototype, {

    // ### Methods (public)
    // 
    // #### enqueue(work_data, {cb})
    //
    // Create and enqueue a new Job
    enqueue: function (options, cb) {
        var self = this;
        var job = new Job(self, options);

        var _done = function (err, result) {
            if (cb) {
                try {
                    cb(err, result);
                } catch(e) { // TODO: What to do here?
                    util.error("Problem with callback: " + e);
                }
            }
            self.jobs_ct++;
            self.emit('done', job);
        };

        job.on('success', function (r) { 
            _done(null, r);
        }).on('failure', function (err) { 
            _done(err, null);
        }).on('abort', function () {
            self.backlog = _.without(self.backlog, job);
        }).on('retry', function () {
            self._taskWorkerProcess(job);
        });
        
        Job.ALL_EVENTS.forEach(function (name) {
            job.on(name, function (data) {
                self.emit('Job:' + name, job, data);
            })
        });

        process.nextTick(function () {
            self.enqueue_ct++;
            self.emit('enqueue', job);
            self._taskWorkerProcess(job);
        });

        return job;
    },

    // #### spawnWorkers
    //
    // Spawn enough workers to fill the pool. Once they're all ready, emit a
    // 'ready' event for the pool.
    spawnWorkers: function (cb) {
        var self = this;
        var ready = {};
        _.times(this.options.max_processes, function () {
            var wp = self._spawnWorkerProcess();
            if (wp) {
                ready[wp.getPID()] = false;
                wp.once('ready', function (wp) {
                    ready[wp.getPID()] = true;
                    if (_.every(_.values(ready))) {
                        self.emit('ready', self);
                        cb && cb();
                    }
                });
            }
        });
        // TODO: Need to handle failing spawns during startup
    },

    // #### exit
    //
    // Cause all WorkerProcesses to exit (if any). Call this when you're done
    // with the Pool.
    exit: function () {
        this.respawn_workers = false;
        for (pid in this.worker_processes) {
            this.worker_processes[pid].exit();
        }
        this.worker_processes = {};
    },

    // #### getStats
    //
    // Report some statistics on current state of the worker pool.
    getStats: function () {
        var backlog_ct = this.backlog.length;
        var worker_processes = this.worker_processes;
        var workers_ct = 0;
        var busy_ct = 0;

        for (pid in worker_processes) {
            workers_ct++;
            if (!worker_processes[pid].isReady()) { busy_ct++; }
        }

        return {
            jobs: this.jobs_ct,
            backlog: backlog_ct,
            workers: workers_ct,
            busy: busy_ct
        };
    },

    // ### Methods (private)
    //
    // #### _taskWorkerProcess
    //
    // Given a Job, task a Process with its execution. If no
    // Process is free, push it onto the backlog.
    _taskWorkerProcess: function (job) {
        var worker_process = this._findFreeWorkerProcess();
        if (!worker_process) {
            this.backlog.push(job);
            this.emit('backlog', job);
        } else {
            job._watchWorker(worker_process);
            worker_process.acceptJob(job);
            this.emit('task', job, worker_process);
        }
    },

    // #### _findFreeWorkerProcess
    //
    // Find an idle Process available for a new Job. Spawn a new
    // process if the pool is not yet full. Return null, if the pool is full
    // and completely busy.
    _findFreeWorkerProcess: function () {
        for (pid in this.worker_processes) {
            var wp = this.worker_processes[pid];
            if (wp.isReady()) {
                return wp;
            }
        }
        this._spawnWorkerProcess();
        return null;
    },

    // #### _spawnWorkerProcess
    //
    // Spawn a new Process, if the pool is not yet full.
    _spawnWorkerProcess: function () {
        var self = this;

        // Mind the process limit!
        var pids = _.keys(this.worker_processes);
        if (pids.length >= this.options.max_processes) { return null; }
        
        // Spawn and track a new process...
        var worker_options = _.defaults(
            this.options.options || {},
            _.pick(this.options, [
                'timeout_initializing',
                'timeout_working',
                'timeout_recovering'
            ])
        );
        var wp = new WorkerProcess(this, worker_options);
        this.worker_processes[wp.getPID()] = wp;
        wp.on('ready', _.bind(this._onWorkerProcessReady, this))
          .on('exit', _.bind(this._onWorkerProcessExit, this));

        // Proxy all the known worker process events
        WorkerProcess.ALL_EVENTS.forEach(function (name) {
            wp.on(name, function (job, wp) {
                self.emit('WorkerProcess:' + name, job, wp);
            });
        });

        this.emit('spawn', wp);
        return wp;
    },

    // #### _onWorkerProcessReady
    //
    // React to a Process signalling its readiness to handle a job. If there's
    // work waiting in the backlog, pick a job off the top. Otherwise, signal
    // that the pool is idle.
    _onWorkerProcessReady: function (worker_process) {
        var self = this;
        if (this.backlog.length) {
            // HACK: Give other listeners a chance to do something with the
            // ready message before the next job gets tasked.
            process.nextTick(function () {
                self._taskWorkerProcess(self.backlog.shift());
            });
        } else {
            this.idle = _.chain(this.worker_processes).values()
                .every(function (wp) { return wp.isReady(); })
                .value();
            if (this.idle && this.enqueue_ct > 0) {
                // Refrain from emiting 'idle' event until at least some work
                // has been done.
                this.emit('idle');
            }
        }
    },

    // #### _onWorkerProcessExit
    //
    // React to the exit of a Process. Drop the Process from the pool, spawn a
    // replacement if necessary.
    _onWorkerProcessExit: function (worker_process) {
        var self = this;
        var pid = worker_process.getPID();
        delete this.worker_processes[pid];
        if (this.respawn_workers) {
            setTimeout(function () {
                self._spawnWorkerProcess();
            }, this.options.respawn_wait);
        }
        this.emit('exit', worker_process);
    }

});

// Worker
// --------
//
// A Worker instance provides the scaffolding for a worker module.
function Worker (options) {
    var self = this;
    this.options = options || {};
    this.id = 'worker-' + process.pid;

    events.EventEmitter.call(this);
    
    process.on('message', function (msg) {
        var fn_name = '_handle_' + msg.op;
        if (fn_name in self) {
            self[fn_name](msg.data);
        }
    });

    process.on('uncaughtException', function (err) {
        var err_str = ('stack' in err) ?  err.stack : (''+err);
        self.terminalFailure(err_str);
    });
}

// ### Events
//
// A Worker instance emits several events in response to messages from the
// Pool. These are useful in getting things done in a worker module:
//
// * `init (options)` - received options for initialization & configuration
// * `job (work_data)` - received a job on which to work
util.inherits(Worker, events.EventEmitter);

// ### Methods
//
// * `worker.ready()`
//     * Inform the master process that this worker is ready for a job
// * `worker.start()`
//     * Inform the master process that the worker has started the job
// * `worker.progress(data)`
//     * Inform the Job of progress toward completing the task. This can be
//       called repeatedly before the job is completed.
// * `worker.success(data)`
//     * Inform the Job of successful completion of the task. Call this once.
// * `worker.failure(data)`
//     * Inform the Job of failure in completing the task. Call this once.
['ready', 'start', 'progress', 'success', 'failure'].forEach(function (name) {
    Worker.prototype[name] = function (data) {
        return this._send(name, data);
    };
});

// * `worker.terminalFailure(data)`
//     * Inform the Job of failure in completing the task. Also signals that
//       this worker process will terminate, just before doing so. Useful
//       for severe failures, like uncaught exceptions.
Worker.prototype.terminalFailure = function (data) {
    var self = this;
    try {
        process.send({op: 'terminalFailure', data: data});
    } catch (e) {
        // TODO: Anything better to do here? Master process died, usually.
        util.error("Cannot contact master process, exiting: " + e);
    }
    process.exit();
};

_.extend(Worker.prototype, {

    // * (private) _send - send a message to the master process
    _send: function (name, data) {
        try {
            process.send({op: name, data: data});
        } catch (e) {
            // TODO: Anything better to do here? Master process died, usually.
            util.error(this.id + " tried to send " + name + ". " +
                "Cannot contact master process, exiting: " + e);
            process.exit();
        }
    },

    // * (private) _handle_init - handle master process sending config
    _handle_init: function (data) {
        this.options = _.defaults(
            this.options || {},
            data || {}
        );
        this.emit('init', this.options);
    },
    
    // * (private) _handle_job - handle master process sending a job
    _handle_job: function (data) {
        this.emit('job', data);
    }

});


// Job
// ---
//
// A Job instance is obtained from Pool.enqueue(), and it represents a unit of
// work for the Process pool. It may eventually be picked up as a task by a
// Process. It emits events narrating the status of the task.
//
function Job (pool, options) {
    var self = this;

    events.EventEmitter.call(this);
    
    this.id = _.uniqueId('job-');
    this.options = options || {};
    this.retries_left = pool.options.retries;
    this.done = false;
    this.worker_process = null;
    this.listeners = {};
}

// ### Events
//
// A Job instance emits several events that are useful for monitoring the
// status of work:
//
// * `start` - work has been started on the job
// * `abort` - the job has been aborted
// * `progress (result)` - progress reported on the work
// * `success (result)` - the work has been completed successfully
// * `failure (error)` - the process failed in performing the work
// * `retry` - work on the job failed, but another attempt will be made
Job.ALL_EVENTS = ['start', 'abort', 'progress', 'success', 'failure', 'retry'];
util.inherits(Job, events.EventEmitter);

// ### Methods
//
_.extend(Job.prototype, {

    // * `abort()` - abort this job, killing the Process if it's in progress.
    abort: function () {
        this._unwatchWorker();
        this.emit('abort');
    },

    _watchWorker: function (wp) {
        var self = this;
        self.worker_process = wp;
        var prefix = '_handleWorker_';
        _.chain(this).functions().filter(function (name) {
            return name.indexOf(prefix) === 0;
        }).each(function (name) {
            var ev_name = name.substr(prefix.length);
            var handler = _.bind(self[name], self);
            wp.on(ev_name, handler);
            self.listeners[ev_name] = [wp, handler];
        });
    },

    _unwatchWorker: function () {
        var self = this;
        _.each(this.listeners, function (pair, name) {
            pair[0].removeListener(name, pair[1]);
            delete self.listeners[name];
        });
        self.worker_process = null;
    },

    _handleWorker_start: function () {
        this.emit('start');
    },

    _handleWorker_progress: function (wp, job, data) {
        this.emit('progress', data);
    },
    
    _handleWorker_success: function (wp, job, data) {
        this._unwatchWorker();
        this.emit('success', data);
    },
    
    _handleWorker_failure: function (wp, job, data) {
        this._unwatchWorker();
        if (0 == this.retries_left) {
            this.emit('failure', data);
        } else {
            this.retries_left--;
            this.emit('retry', data);
        }
    },

    _handleWorker_timeout: function (wp, job, data) {
        this._handleWorker_failure(wp, this, 'timeout');
    },
    
    _handleWorker_exit: function (wp) {
        this._handleWorker_failure(wp, this, 'exit');
    }

});

// WorkerProcess (private)
// =================
//
// A WorkerProcess manages a child process that can be associated with a Job.
// As a user of node-hirelings, you should never have to work with
// WorkerProcess instances. All the heavy lifting is done with Job instances.
function WorkerProcess (pool, options) {
    var self = this;
    events.EventEmitter.call(this);
    
    this.state = WorkerProcess.spawning;
    this.state_timeout = null;
    this.options = _.defaults(options || {}, WorkerProcess.DEFAULT_OPTIONS);
    this.job = null;
    this.jobs_left = pool.options.max_jobs_per_process;

    this._cprocess = child_process.fork(
        pool.options.module,
        [],
        { env: this._getEnvForWorker() }
    );
    
    this.id = 'workerprocess-' + this._cprocess.pid;

    this._cprocess.on('exit', function () {
        self.emit('exit', self);
    });

    process.nextTick(function () {
        self._cprocess.on('message', _.bind(self._onMessage, self));
        self.send({op: 'init', data: self.options});
        self.setState('initializing');
    });
}

WorkerProcess.DEFAULT_OPTIONS = {
};

WorkerProcess.STATES = {
    initializing: 'initializing',
    ready: 'ready',
    working: 'working',
    recovering: 'recovering',
    exiting: 'exiting'
};

WorkerProcess.ALL_EVENTS = [
    'initializing', 'ready', 'working', 'recovering', 'exiting', 'start',
    'progress', 'success', 'failure', 'done', 'timeout', 'exit'
];

util.inherits(WorkerProcess, events.EventEmitter);

_.extend(WorkerProcess.prototype, {

    setState: function (state) {
        // Only allow states from the known set.
        if (!(state in WorkerProcess.STATES)) { return; }
        
        // Set the state & emit the change
        this.state = WorkerProcess.STATES[state];
        this.emit(this.state, this);

        // Clear any previously set state-change timer
        if (this.state_timeout) {
            clearTimeout(this.state_timeout);
        }

        // We're done if we're exiting
        if ('exiting' === state) { return; }

        // Set a state-change timer for this state, if necessary
        var self = this;
        var to_name = 'timeout_' + state;
        if (to_name in this.options) {
            self.state_timeout = setTimeout(function () {
                self.timeout(state);
            }, this.options[to_name]);
        }
    },

    send: function (data) {
        this._cprocess.send(data);
    },

    isReady: function () {
        return (this.state == WorkerProcess.STATES.ready);
    },

    acceptJob: function (job) {
        var self = this;
        if (this.state !== WorkerProcess.STATES.ready) {
            throw "Process is not ready for work";
        }
        this.job = job;
        job.on('abort', this.job_listener = function () {
            self.exit();
        });
        this._cprocess.send({op: 'job', data: job.options});
        this.setState('working');
    },

    flushJob: function () {
        if (!this.job) { return; }
        this.job.removeListener('abort', this.job_listener);
        this.job = null;
    },

    getPID: function () {
        return this._cprocess.pid;
    },

    exit: function () {
        this.setState('exiting');
        this._cprocess.kill();
        this.flushJob();
    },

    timeout: function (state) {
        var self = this;
        self.emit('timeout', self, state);
        // HACK: ensure listeners can react to 'timeout' before 'exit'
        process.nextTick(function () {
            self.exit();
        });
    },

    _onMessage: function (msg) {
        var fn_name = '_handleProcess_' + msg.op;
        if (fn_name in this) {
            return this[fn_name](msg);
        } else {
            // No-op
        }
    },

    _handleProcess_ready: function (msg) {
        this.jobs_left--;
        if (this.jobs_left <= 0) {
            return this.exit();
        }
        return this.setState('ready');
    },

    _handleProcess_start: function (msg) {
        this.emit(msg.op, this, this.job);
    },

    _handleProcess_progress: function (msg) {
        this.emit(msg.op, this, this.job, msg.data);
    },

    _handleProcess_success: function (msg) {
        this.emit(msg.op, this, this.job, msg.data);
        this.flushJob();
        this.setState('recovering');
    },

    _handleProcess_failure: function (msg) {
        this.emit(msg.op, this, this.job, msg.data);
        this.flushJob();
        this.setState('recovering');
    },

    _handleProcess_terminalFailure: function (msg) {
        this.emit('failure', this, this.job, msg.data);
        this.setState('exiting');
    },

    _getEnvForWorker: function() {
        var env = {};
        for (var i in process.env) {
            env[i] = process.env[i];
        }
        delete env.NODE_WORKER_ID; //Node.js cluster worker marker for v0.6
        delete env.NODE_UNIQUE_ID; //Node.js cluster worker marker for v0.7
        return env;
    }

});

Pool.ALL_EVENTS = _.union(
    ['spawn', 'ready', 'enqueue', 'task', 'backlog', 'done', 'idle'],
    _.map(Job.ALL_EVENTS,
        function (n) { return 'Job:' + n; }),
    _.map(WorkerProcess.ALL_EVENTS, 
        function (n) { return 'WorkerProcess:' + n; })
);

module.exports = {
    Pool: Pool,
    Worker: Worker
};
