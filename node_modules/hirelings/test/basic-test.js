// TODO: Test new pool events
// TODO: Better reporting of uncaughtExceptions - just get an "exit" right now,
//       need message & stack
// TODO: Test backlog vs hireling pool
// TODO: Optionally enforce a max backlog size with immediate job errors
// TODO: Enforce max job execution time
// TODO: Enforce max memory usage, use process.memoryUsage() in hireling to
//       report memory usage to parent?
var util = require('util'),
    vows = require('vows'),
    assert = require('assert'),
    path = require('path'),
    _ = require('underscore'),
    hirelings = require('../lib/hirelings');

var DEBUG = false;
var POOL_TIMEOUT = 10000;
var MAX_PROCESSES = 4;
var MAX_JOBS = 4;
var LOTS_OF_JOBS = ((MAX_PROCESSES * MAX_JOBS) + 5);
var MAX_KILLS = 5;

var suite = vows.describe('Basic processes tests');

if (DEBUG) {
    process.on('uncaughtException', function (e) {
        util.debug("EXCEPTION " + e.stack);
    });
}

function poolTopic (worker_name, options) {
    var self = this;

    options = _.defaults(options || {}, {
        max_processes: MAX_PROCESSES,
        module: __dirname + '/workers/' + worker_name + '.js',
        options: { thing: 'ohai' }
    })
    var pool = new hirelings.Pool(options);

    setTimeout(function () {
        util.debug("POOL EXIT TIMEOUT");
        pool.exit();
    }, POOL_TIMEOUT);

    if (DEBUG || options.debug) hirelings.Pool.ALL_EVENTS.forEach(function (name) {
        pool.on(name, function () {
            var out = pool.id + ' ' + name + ' ';
            try {
                if ('idle' == name) {
                    // No-op
                } else if ('task' == name) {
                    out += arguments[0].id + ' -> ' + arguments[1].id;
                } else if (['WorkerProcess:ready',
                            'WorkerProcess:exit'].indexOf(name) !== -1) {
                    out += arguments[0].id;
                } else if (['WorkerProcess:start',
                            'WorkerProcess:progress',
                            'WorkerProcess:success',
                            'WorkerProcess:failure'].indexOf(name) !== -1) {
                    out += arguments[0].id + ' -> ' + arguments[1].id;
                } else if ('WorkerProcess:timeout' == name) {
                    out += arguments[0].id + ' ' + arguments[1];
                } else if (['Job:start',
                            'Job:progress',
                            'Job:success',
                            'Job:failure'].indexOf(name) !== -1) {
                    out += arguments[0].id;
                } else {
                    out += arguments[0].id;
                }
            } catch (e) {
                out += ' ERR ' + e;
                // No-op
            }
            util.debug(Date.now() + ' ' + out);
        });
    });
    
    return pool;
};

function waitForReadyPoolTopic (pool) {
    var self = this;
    pool.once('ready', function (pool) {
        self.callback(null, pool);
    });
    pool.spawnWorkers();
}

function jobResultTopic (job) {
    var self = this;
    var events = [];

    var all_events = ['start', 'progress', 'success', 'error', 'failure'];
    var final_events = ['success', 'failure'];

    all_events.forEach(function (name) {
        job.on(name, function (data) {
            events.push([name, data]);
            if (-1 != final_events.indexOf(name)) {
                self.callback(null, events);
            }
        });
    });
};

if (true) suite.addBatch({
    'a Pool running an echo worker': {
        topic: poolTopic('echo'),
        'that enqueues a successful Job with a callback': {
            topic: function (pool) {
                pool.enqueue({whatsit: 'orly'}, this.callback);
            },
            'should result in options and job data echoed to the callback': function (result) {
                assert.deepEqual(result, {
                    job: {whatsit: 'orly'},
                    options: {
                        thing: 'ohai',
                        timeout_initializing: 5000,
                        timeout_working: 10000,
                        timeout_recovering: 5000
                    }
                });
            }
        }
    }
});

if (true) suite.addBatch({
    'a Pool running a noisy worker': {
        topic: poolTopic('noisy'),
        'given time to spawn processes before enqueuing': {
            topic: waitForReadyPoolTopic,
            'a succesful Job': {
                topic: function (pool) {
                    this.pool = pool;
                    return pool.enqueue({whatsit: 'orly'});
                },
                'should result in at least one Process': function (job) {
                    var pool = this.pool;
                    var pids = _.keys(pool.worker_processes);
                    assert.ok(pids.length > 0);
                    var hp = pool.worker_processes[pids[0]];
                    assert.ok(hp);
                    assert.ok(hp.getPID());
                },
                'to which event handlers are attached': {
                    topic: jobResultTopic,
                    'should result in successful events': function (err, result) {
                        assert.deepEqual(result, [
                            [ 'start', undefined ],
                            [ 'progress', 1 ],
                            [ 'progress', 2 ],
                            [ 'progress', 3 ],
                            [ 'success', {
                                options: {
                                    thing: 'ohai',
                                    timeout_initializing: 5000,
                                    timeout_working: 10000,
                                    timeout_recovering: 5000
                                },
                                job: {whatsit: 'orly'}
                            }]
                        ]);
                    }
                }
            },
            'a failing Job with a callback': {
                topic: function (pool) {
                    pool.enqueue({cause_failure: true}, this.callback);
                },
                'should result in an error to the callback': function (err, result) {
                    assert.equal(result, null);
                    assert.ok(!!err);
                }
            },
            'a failing Job': {
                topic: function (pool) {
                    return pool.enqueue({message: 'ohai', cause_failure: true});
                },
                'to which event handlers are attached': {
                    topic: jobResultTopic,
                    'should result in a failure event': function (err, result) {
                        assert.deepEqual(result.pop(), 
                            ['failure', 'THIS IS A FAILURE']);
                    }
                }
            }
        }
    }
});

if (true) suite.addBatch({
    'a Pool with max_job_per_process=4': {
        topic: poolTopic('echo', {
            max_jobs_per_process: MAX_JOBS
        }),
        'given time to spawn processes': {
            topic: waitForReadyPoolTopic,
            "with process counting": {
                topic: function (pool) {
                    var self = this;
                    var processes = {};
                    _.keys(pool.worker_processes).forEach(function (pid) {
                        processes[pid] = 0;
                    });
                    pool.on('spawn', function (p) {
                        processes[p.getPID()] = 0;
                    });
                    pool.on('task', function (job, p) {
                        processes[p.getPID()]++;
                    });
                    var finished = {};
                    var maybe = function (job) {
                        return function () {
                            finished[job.id] = true;
                            if (_.every(_.values(finished))) {
                                self.callback(null, processes, pool);
                            }
                        };
                    };
                    _.times(LOTS_OF_JOBS, function () {
                        var job = pool.enqueue({something: "interesting"});
                        finished[job.id] = false;
                        job.on('success', maybe(job));
                        job.on('finished', maybe(job));
                    });
                },
                'should result in no processes having performed more than 4 jobs': 
                        function (err, processes, pool) {
                    for (pid in processes) {
                        var num_jobs = processes[pid];
                        assert.ok(num_jobs <= MAX_JOBS,
                            "Process " + pid + " should have performed " + MAX_JOBS +
                            " or less, but performed " + num_jobs);
                    }
                }
            }
        }
    }
});

if (true) suite.addBatch({
    'a Pool running a sleep worker': {
        topic: poolTopic('sleep'),
        'given time to spawn processes': {
            topic: waitForReadyPoolTopic,
            'with a Job enqueued and a Process later killed': {
                topic: function (pool) {
                    var job = pool.enqueue({delay: 500});
                    setTimeout(function () {
                        // HACK: Reaching into guts, but this is unusual
                        job.worker_process._cprocess.kill();
                    }, 200);
                    return jobResultTopic.call(this, job);
                },
                'should gracefully result in a failure': function (result) {
                    assert.deepEqual(result.pop(), ['failure', 'exit']);
                }
            }
        }
    }
});

if (true) suite.addBatch({
    'a Pool running a sleep worker': {
        topic: poolTopic('sleep'),
        'given time to spawn processes': {
            topic: waitForReadyPoolTopic,
            'that enqueues more Jobs than available Processes': {
                topic: function (pool) {
                    var self = this;
                    _.times(LOTS_OF_JOBS, function () {
                        pool.enqueue({delay: 200});
                    });
                    // Wait a tick, to allow enqueueing to task or backlog
                    process.nextTick(function () {
                        var stats = pool.getStats();
                        pool.exit();
                        self.callback(null, stats);
                    });
                },
                'should result in a backlog': function (stats) {
                    assert.ok(stats.backlog > 0);
                    assert.equal(stats.backlog, LOTS_OF_JOBS - MAX_PROCESSES);
                },
                'should not result in more workers than maximum': function (stats) {
                    assert.ok(stats.workers <= MAX_PROCESSES);
                },
                'should result in all workers busy': function (stats) {
                    assert.equal(MAX_PROCESSES, stats.busy);
                }
            }
        }
    }
});

if (true) suite.addBatch({
    'a Pool running a sleep worker': {
        topic: function () {
            var $this = this;
            var pool = this.pool = poolTopic('sleep', {
                options: { }
            });
            this.jobs_ct = 0;
            pool.on('done', function (job) {
                $this.jobs_ct++;
            });
            return pool;
        },
        'that also enqueues more Jobs than available Processes': {
            topic: function (pool) {
                var jobs = [];
                for (var i = 0; i < (MAX_PROCESSES * 2); i++) {
                    jobs.push(pool.enqueue({delay: 400}));
                }
                return jobs;
            },
            'and aborts some Jobs': {
                topic: function (jobs) {
                    for (var i=0; i<MAX_PROCESSES; i++) {
                        jobs.shift().abort();
                    }
                    var self = this;
                    self.pool.on('idle', function () {
                        self.pool.exit();
                        self.callback();
                    });
                },
                'should result in an empty backlog': function (pool) {
                    var stats = this.pool.getStats();
                    assert.equal(stats.backlog, 0);
                },
                'should result in expected number of jobs completed': function (pool) {
                    var stats = this.pool.getStats();
                    assert.equal(stats.jobs, this.jobs_ct);
                }
            }
        }
    }
});

if (true) suite.addBatch({
    'a Pool running an unreliable worker and retries=6': {
        topic: poolTopic('unreliable', {
            retries: MAX_KILLS + 1
        }),
        'given time to spawn processes': {
            topic: waitForReadyPoolTopic,
            'with jobs enqueued and killed 5 times each': {
                topic: function (pool) {
                    var self = this;
                    var results = {};
                    pool.on('enqueue', function (job) {
                        var result = results[job.id] = { kill: 0, exit: 0 };
                        ['retry', 'failure', 'success'].forEach(function (name) {
                            result[name] = 0;
                            job.on(name, function () { result[name]++; });
                        });
                    });
                    pool.on('task', function (job, worker) {
                        if (results[job.id].kill++ >= MAX_KILLS) { return; }
                        // HACK: Reaching into guts, but this is unusual
                        setTimeout(function () {
                            worker._cprocess.kill();
                        }, 50);
                    });
                    pool.on('exit', function (worker) {
                        if (worker.job) { results[worker.job.id].exit++; }
                    });
                    pool.on('idle', function () {
                        self.callback(null, results);
                    });
                    _.times(MAX_PROCESSES * 2, function (i) {
                        pool.enqueue(i);
                    });
                },
                'should result in the expected number of exits detected': function (err, results) {
                    _.each(results, function (result) {
                        assert.equal(result.exit, MAX_KILLS);
                    });
                },
                'should result in the expected number of retries': function (err, results) {
                    _.each(results, function (result) {
                        assert.equal(result.exit, MAX_KILLS);
                    });
                },
                'should result in success for all jobs': function (err, results) {
                    _.each(results, function (result) {
                        assert.equal(result.success, 1);
                    });
                },
                'should result in failure for no jobs': function (err, results) {
                    _.each(results, function (result) {
                        assert.equal(result.failure, 0);
                    });
                }
            }
        }
    }
});

var uncaught_count = 0;

if (true) suite.addBatch({
    'a Pool running an uncaught exception worker': {
        topic: poolTopic('uncaught', {
            retries: 3
        }),
        'that enqueues a job': {
            topic: function (pool) {
                pool.enqueue({does: 'not matter'}, this.callback);
            },
            'should result in a terminal failure': function (err, result) {
                var err_str = "TypeError: Object #<Object> has no method 'thisMethodDoesNotExist'";
                assert.ok(err.indexOf(err_str) === 0);
                assert.ok(err.indexOf('test/workers/uncaught.js') !== -1);
            },
            'should result in only one terminal failure': function (err, result) {
                uncaught_count++;
                assert.equal(uncaught_count, 1);
            }
        }
    }
});

function enqueueThenWaitIdleTopic (pool) {
    var result, err, self = this;
    pool.enqueue({whoo: 'hoo'}, function (err_in, result_in) {
        err = err_in;
        result = result_in;
    });
    pool.on('idle', function () {
        pool.exit();
        self.callback(null, {err: err, result: result});
    });
}

function countTimeoutEventsTopic (pool) {
    var stats = this.stats = {
        spawn: 0,
        exit: 0,
        timeout: {}
    };
    pool.on('spawn', function () { stats.spawn++; });
    pool.on('WorkerProcess:exit', function () { stats.exit++; });
    pool.on('WorkerProcess:timeout', function (_, name) {
        stats.timeout[name] = true;
    });
    return pool;
}

if (true) suite.addBatch({
    'a Pool running a slow worker with timeout_working=5000': {
        topic: poolTopic('slow', {
            timeout_working: 5000
        }),
        'that enqueues a job': {
            topic: enqueueThenWaitIdleTopic,
            'should result in a success': function (r) {
                assert.deepEqual(r.result, {whoo: 'hoo'});
            }
        }
    },
    'a Pool running a slow worker with timeout_working=50': {
        topic: poolTopic('slow', {
            timeout_working: 50
        }),
        'that enqueues a job': {
            topic: enqueueThenWaitIdleTopic,
            'should result in a failure result': function (r) {
                assert.deepEqual(r.err, 'timeout');
            }
        }
    },
    'a Pool running a slow worker with timeout_working=50 and retries=3': {
        topic: poolTopic('slow', {
            timeout_working: 50,
            retries: 3
        }),
        'that enqueues a job': {
            topic: enqueueThenWaitIdleTopic,
            'should result in a failure result': function (r) {
                assert.deepEqual(r.err, 'timeout');
            }
        }
    }
});

if (true) suite.addBatch({
    'a Pool running a slow worker with timeout_recovering=5000': {
        topic: poolTopic('slow', {
            timeout_recovering: 5000
        }),
        'with listeners for timeouts': {
            topic: countTimeoutEventsTopic,
            'that enqueues a job': {
                topic: enqueueThenWaitIdleTopic,
                'should result in a success': function (r) {
                    assert.deepEqual(r.result, {whoo: 'hoo'});
                },
                'should result in no timeout while recovering': function () {
                    assert.deepEqual(this.stats, {
                        spawn: 1, exit: 0, timeout: {}
                    });
                }
            }
        }
    },
    'a Pool running a slow worker with timeout_recovering=50': {
        topic: poolTopic('slow', {
            timeout_recovering: 50
        }),
        'with listeners for timeouts': {
            topic: countTimeoutEventsTopic,
            'that enqueues a job': {
                topic: enqueueThenWaitIdleTopic,
                'should result in a success': function (r) {
                    assert.deepEqual(r.result, {whoo: 'hoo'});
                },
                'should result in a timeout while recovering': function () {
                    assert.deepEqual(this.stats, {
                        spawn: 2, exit: 1, timeout: { recovering: true }
                    });
                }
            }
        }
    }
});

if (true) suite.addBatch({
    'a Pool running a slow worker with timeout_initializing=5000': {
        topic: poolTopic('slow', {
            timeout_initializing: 5000
        }),
        'with listeners for timeouts': {
            topic: countTimeoutEventsTopic,
            'that enqueues a job': {
                topic: enqueueThenWaitIdleTopic,
                'should result in a success': function (r) {
                    assert.deepEqual(r.result, {whoo: 'hoo'});
                },
                'should result in no timeout while initializing': function () {
                    assert.ok(!('initializing' in this.stats.timeout));
                },
                'should result in no worker respawns': function () {
                    assert.ok(this.stats.spawn === 1);
                    assert.ok(this.stats.exit === 0);
                }
            }
        }
    },
    'a Pool running a slow worker with timeout_initializing=50': {
        topic: poolTopic('slow', {
            timeout_initializing: 50,
            respawn_wait: 100
        }),
        'with listeners for timeouts': {
            topic: countTimeoutEventsTopic,
            'that enqueues a job with an early exit to break the respawn loop': {
                topic: function (pool) {
                    var result, err, self = this;
                    pool.enqueue({whoo: 'hoo'}, function (err_in, result_in) {
                        err = err_in;
                        result = result_in;
                    });
                    setTimeout(function () {
                        pool.exit();
                        self.callback(null, {err: err, result: result});
                    }, 500);
                },
                'should yield no result': function (r) {
                    assert.ok(!r.result);
                    assert.ok(!r.err);
                },
                'should result in a timeout while initializing': function () {
                    assert.ok('initializing' in this.stats.timeout);
                },
                'should result in multiple worker respawns': function () {
                    assert.ok(this.stats.spawn > 1);
                    assert.ok(this.stats.exit > 1);
                }
            }
        }
    }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
