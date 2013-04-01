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
// A instance of Pool manages a pool of Hirelings. Jobs can be enqueued and
// tasked to Hirelings. When all the Hirelings in the pool are busy, Jobs are
// kept in a FIFO backlog.
function Pool (options) {
    var self = this;
    events.EventEmitter.call(this);
    this.options = _.defaults(options, {
        max_jobs_per_process: 64,
        concurrency: 8 || Math.ceil(require('os').cpus().length * 1.25)
    });
    this.backlog = [];
    this.hirelings = {};
}

// ### Events
//
// A Pool instance offers several events to which handlers can listen. These
// are mostly useful for monitoring the activity of the Pool, and aren't
// necessary for getting work done.
//
// * `spawn (Process)` - a Process has been spawned
// * `exit (Process)` - a Process has exited
// * `task (job, hireling)` - a Process has been tasked with a Job
// * `backlog (job)` - a Job has been queued into the backlog
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
            self._taskHireling(job);
        });
        if (cb) {
            // Abstract away the event handlers, if a callback was supplied.
            job.on('success', function (r) { cb(null, r); })
               .on('failure', function (err) { cb(err, null); });
        }
        return job;
    },

    // #### exit
    //
    // Cause all Processes to exit (if any). Call this when you're done
    // with the Pool.
    exit: function () {
        for (pid in this.hirelings) {
            this.hirelings[pid].exit();
        }
    },

    //
    // ### Methods (private)
    //
    // #### _taskHireling
    //
    // Given a Job, task a Process with its execution. If no
    // Process is free, push it onto the backlog.
    _taskHireling: function (job) {
        var self = this;
        var hireling = self._findFreeHireling();
        if (!hireling) {
            this.backlog.push(job);
            this.emit('backlog', job);
        } else {
            hireling.acceptJob(job);
            this.emit('task', job, hireling);
        }
    },

    // #### _findFreeHireling
    //
    // Find an idle Process available for a new Job. Spawn a new
    // process if the pool is not yet full. Return null, if the pool is full
    // and completely busy.
    _findFreeHireling: function () {
        for (pid in this.hirelings) {
            var hireling = this.hirelings[pid];
            if (!hireling.job) { return hireling; }
        }
        return this._spawnHireling();
    },

    // #### _spawnHireling
    //
    // Spawn a new Process, if the pool is not yet full.
    _spawnHireling: function () {
        var pids = _.keys(this.hirelings);
        if (pids.length >= this.options.concurrency) {
            return null;
        }
        var hp = new Process(this, this.options.options);
        this.hirelings[hp.process.pid] = hp;
        this.emit('spawn', hp);
        return hp;
    },

    // #### _onHirelingExit
    //
    // React to the exit of a Process. If the process had a current
    // Job, report the exit as a failure. Either way, drop the Process
    // from the pool.
    _onHirelingExit: function (hireling) {
        if (hireling.job) {
            hireling.job.emit('failure', 'exit');
        }
        delete this.hirelings[hireling.process.pid];
        this.emit('exit', hireling);
        // TODO: Spawn a replacement? Currently wait until a new Job needs one.
    },

    // #### _onJobDone
    //
    // React to the exit of a finished Job. Disassociate the Job from its
    // Process to mark it idle, and task a hireling with the next Job
    // in the backlog (if any).
    _onJobDone: function (job) {
        if (job.hireling) {
            var hireling = job.hireling;
            hireling.job = null;
            if (hireling.jobs_count >= this.options.max_jobs_per_process) {
                hireling.exit();
            }
        }
        if (this.backlog.length) {
            this._taskHireling(this.backlog.shift());
        } else {
            for (pid in this.hirelings) {
                if (this.hirelings[pid].job) { return; }
            }
            this.emit('drain');
        }
    }

});

// Hireling
// --------
//
// A Hireling instance provides the scaffolding for a worker module to offer
// its services as a hireling.
function Hireling (options) {
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
// A Hireling instance emits several events in response to messages from the
// Pool. These are useful in getting things done in a worker module:
//
// * `init (options)` - received options for initialization & configuration
// * `job (work_data)` - received a job on which to work
util.inherits(Hireling, events.EventEmitter);

_.extend(Hireling.prototype, {
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
// * `hireling.progress(data)`
//     * Inform the Job of progress toward completing the task. This can be
//       called repeatedly before the job is completed.
// * `hireling.success(data)`
//     * Inform the Job of successful completion of the task. Call this once.
// * `hireling.failure(data)`
//     * Inform the Job of failure in completing the task. Call this once.
['progress', 'success', 'failure'].forEach(function (name) {
    Hireling.prototype[name] = function (data) {
        process.send({op: name, data: data});
    };
});

// Job
// ---
//
// A Job instance is obtained from Pool.enqueue(), and it represents a unit of
// work for the Hireling pool. It may eventually be picked up as a task by a
// Hireling. It emits events narrating the status of the task.
//
function Job (pool, options) {
    var self = this;

    events.EventEmitter.call(this);
    
    this.pool = pool;
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
// * `failure (error)` - the hireling failed in performing the work
util.inherits(Job, events.EventEmitter);

// ### Methods
//
_.extend(Job.prototype, {

    // * `abort()` - abort this job, killing the Process if it's in progress.
    abort: function () {
        this.emit('abort');
        if (this.hireling) {
            this.hireling.exit();
        }
    }
});

// Process (private)
// =================
//
// A Process manages a child process that can be associated with a Job. As a
// user of Hirelings, you should never have to work with Process instances.
// All the heavy lifting is done with Job instances.
function Process (pool, options) {
    var self = this;
    events.EventEmitter.call(this);
    
    this.pool = pool;
    this.options = options;
    this.job = null;
    this.jobs_count = 0;

    this.process = child_process.fork(
        pool.options.module,
        [],
        { env: this._getEnvForWorker() }
    );
    this.process.on('exit', function () {
        self.pool._onHirelingExit(self);
    });
    // A Process just proxies messages to the current Job
    this.process.on('message', function (msg) {
        if (self.job) {
            self.job.emit(msg.op, msg.data);
        }
    });
    
    this.send({op: 'init', data: this.options});
}

util.inherits(Process, events.EventEmitter);

_.extend(Process.prototype, {

    exit: function () {
        this.process.kill();
        this.pool._onHirelingExit(this);
    },

    send: function (data) {
        this.process.send(data);
    },

    acceptJob: function (job) {
        if (this.job) { throw "Hireling already has a job"; }
        this.jobs_count++;
        this.job = job;
        job.hireling = this;
        this.process.send({op: 'job', data: job.options});
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
    Hireling: Hireling
};
