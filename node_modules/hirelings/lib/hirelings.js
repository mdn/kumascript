// node-hirelings
// ==============
//
// node-hirelings is a lightweight work queue using child processes. 
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
    this.options = _.defaults(options, {
        max_jobs_per_process: 64,
        max_processes: Math.ceil(require('os').cpus().length * 1.25),
        retries: 0
    });
    this.jobs_ct = 0;
    this.backlog = [];
    this.worker_processes = {};
}

// ### Events
//
// A Pool instance offers several events to which handlers can listen. These
// are mostly useful for monitoring the activity of the Pool, and aren't
// necessary for getting work done.
//
// * `spawn (Process)` - a Process has been spawned
// * `exit (Process)` - a Process has exited
// * `task (job, process)` - a Process has been tasked with a Job
// * `backlog (job)` - a Job has been queued into the backlog
// * `done (job)` - a Job has been completed (success or error)
// * `drain` - the backlog has been drained and all Processes are idle
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
        process.nextTick(function () {
            self._taskWorkerProcess(job);
        });
        if (cb) {
            // Abstract away the event handlers, if a callback was supplied.
            job.on('success', function (r) { 
                try {
                    cb(null, r); 
                } catch(e) {
                    // TODO: What to do here?
                    util.error("Problem with success callback: " + e);
                    util.debug("Details: " + util.inspect(job));
                }
            });
            job.on('failure', function (err) { 
                try { 
                    cb(err, null); 
                } catch(e) {
                    // TODO: What do do here?
                    util.error("Problem with error callback: " + e);
                    util.debug("Details: " + util.inspect(job));
                }
            });
        }
        return job;
    },

    // #### exit
    //
    // Cause all WorkerProcesses to exit (if any). Call this when you're done
    // with the Pool.
    exit: function () {
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
            if (worker_processes[pid].job) { busy_ct++; }
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
        var self = this;
        var worker_process = self._findFreeWorkerProcess();
        if (!worker_process) {
            this.backlog.push(job);
            this.emit('backlog', job);
        } else {
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
            var worker_process = this.worker_processes[pid];
            if (!worker_process.job) { return worker_process; }
        }
        return this._spawnWorkerProcess();
    },

    // #### _spawnWorkerProcess
    //
    // Spawn a new Process, if the pool is not yet full.
    _spawnWorkerProcess: function () {
        var pids = _.keys(this.worker_processes);
        if (pids.length >= this.options.max_processes) {
            return null;
        }
        var hp = new WorkerProcess(this, this.options.options);
        this.worker_processes[hp.getPID()] = hp;
        this.emit('spawn', hp);
        return hp;
    },

    // #### _onWorkerProcessExit
    //
    // React to the exit of a Process. If the process had a current
    // Job, report the exit as a failure. Either way, drop the Process
    // from the pool.
    _onWorkerProcessExit: function (worker_process) {
        // Yank the process out of the pool.
        delete this.worker_processes[worker_process.getPID()];
        if (worker_process.job) {
            worker_process.job.send('failure', 'exit');
        }
        this.emit('exit', worker_process);
        // TODO: Spawn a replacement? Currently wait until a new Job needs one.
    },

    // #### _onJobDone
    //
    // React to the exit of a finished Job. Disassociate the Job from its
    // Process to mark it idle, and task a process with the next Job
    // in the backlog (if any).
    _onJobDone: function (job) {
        var self = this;

        this.jobs_ct++;
        this.emit('done', job);
        if (job.worker_process) {
            var worker_process = job.worker_process;
            worker_process.job = null;
            if (worker_process.jobs_count >= this.options.max_jobs_per_process) {
                worker_process.exit();
            }
        }
        if (this.backlog.length) {
            this._taskWorkerProcess(this.backlog.shift());
        } else {
            // Wait a tick, and report drained queue if workers all idle.
            process.nextTick(function () {
                for (pid in self.worker_processes) {
                    if (self.worker_processes[pid].job) { return; }
                }
                self.emit('drain');
            });
        }
    }

});

// Worker
// --------
//
// A Worker instance provides the scaffolding for a worker module.
function Worker (options) {
    var self = this;
    this.options = options;

    events.EventEmitter.call(this);
    
    process.on('message', function (msg) {
        self['_handle_'+msg.op](msg.data);
    });
    process.on('uncaughtException', function (err) {
        self.failure(err);
        process.exit();
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

_.extend(Worker.prototype, {
    _handle_init: function (data) {
        this.options = _.defaults(
            this.options || {},
            data || {}
        );
        this.emit('init', this.options);
    },
    _handle_job: function (data) {
        process.send({op: 'start'});
        this.emit('job', data);
    }
});

// ### Methods
//
// * `worker.progress(data)`
//     * Inform the Job of progress toward completing the task. This can be
//       called repeatedly before the job is completed.
// * `worker.success(data)`
//     * Inform the Job of successful completion of the task. Call this once.
// * `worker.failure(data)`
//     * Inform the Job of failure in completing the task. Call this once.
['progress', 'success', 'failure'].forEach(function (name) {
    Worker.prototype[name] = function (data) {
        var self = this;
        try {
            process.send({op: name, data: data});
        } catch (e) {
            // TODO: Anything better to do here? Master process died, usually.
            util.error("Cannot contact master process, exiting: " + e);
            util.debug("Details: " + name + " " + util.inspect(self.job));
            process.exit();
        }
    };
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
    
    this.pool = pool;
    this.retries_left = pool.options.retries;
    this.options = options;
    this.done = false;
    
    var _done = function () {
        if (self.done) { return; }
        self.done = true;
        self.pool._onJobDone(self);
    };

    this.on('success', _done);
    this.on('failure', _done);
    this.on('abort', _done);
}

// ### Events
//
// A Job instance emits several events that are useful for monitoring the
// status of work:
//
// * `progress (result)` - progress reported on the work
// * `success (result)` - the work has been completed successfully
// * `failure (error)` - the process failed in performing the work
util.inherits(Job, events.EventEmitter);

// ### Methods
//
_.extend(Job.prototype, {

    // * `abort()` - abort this job, killing the Process if it's in progress.
    abort: function () {
        this.emit('abort');
        if (this.worker_process) {
            this.worker_process.exit();
        }
    },

    // * `send()` - emit message for job, with optional handler trap
    send: function (op, data) {
        var m = '_handle_' + op;
        if (m in this) {
            this[m](data);
        } else {
            this.emit(op, data);
        }
    },

    // * `_handle_failure` - trap job failure, with optional retries
    _handle_failure: function (data) {
        var self = this;
        if (0 == this.retries_left) {
            this.emit('failure', data);
        } else {
            this.retries_left--;
            process.nextTick(function () {
                self.pool._taskWorkerProcess(self);
            });
            this.send('retry');
        }
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
    
    this.pool = pool;
    this.options = options;
    this.job = null;
    this.jobs_count = 0;

    this._cprocess = child_process.fork(
        pool.options.module,
        [],
        { env: this._getEnvForWorker() }
    );
    this._cprocess.on('exit', function () {
        self.pool._onWorkerProcessExit(self);
    });
    // A Process just proxies messages to the current Job
    this._cprocess.on('message', function (msg) {
        if (self.job) {
            self.job.send(msg.op, msg.data);
        }
    });
    
    this.send({op: 'init', data: this.options});
}

util.inherits(WorkerProcess, events.EventEmitter);

_.extend(WorkerProcess.prototype, {

    exit: function () {
        this._cprocess.kill();
        this.pool._onWorkerProcessExit(this);
    },

    send: function (data) {
        this._cprocess.send(data);
    },

    acceptJob: function (job) {
        if (this.job) { throw "Process already has a job"; }
        this.jobs_count++;
        this.job = job;
        job.worker_process = this;
        this._cprocess.send({op: 'job', data: job.options});
    },

    getPID: function () {
        return this._cprocess.pid;
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

module.exports = {
    Pool: Pool,
    Worker: Worker
};
