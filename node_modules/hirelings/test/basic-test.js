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

var MAX_PROCESSES = 4;
var MAX_JOBS = 6;
var LOTS_OF_JOBS = ((MAX_PROCESSES * MAX_JOBS) + 10);
var MAX_KILLS = 5;

var suite = vows.describe('Basic processes tests');

var job_result_topic = function (job) {
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

suite.addBatch({
    'a Pool running an echo worker': {
        topic: function () {
            var pool = new hirelings.Pool({
                max_processes: MAX_PROCESSES,
                module: __dirname + '/workers/echo.js',
                options: { thing: 'ohai' }
            });
            setTimeout(function () { pool.exit(); }, 100);
            return pool;
        },
        'can be instantiated': function (pool) {
            assert.isObject(pool);
        },
        'should start with no Process instances': function (pool) {
            var pids = _.keys(pool.worker_processes);
            assert.equal(pids.length, 0);
        },
        'that enqueues': {
            'a successful Job with a callback': {
                topic: function (pool) {
                    pool.enqueue({whatsit: 'orly'}, this.callback);
                },
                'should result in echoed data to the callback': function (err, result) {
                    assert.deepEqual(result, {
                        options: { thing: 'ohai' },
                        job: {whatsit: 'orly'}
                    });
                }
            },
            'a succesful Job': {
                topic: function (pool) {
                    return pool.enqueue({whatsit: 'orly'});
                },
                'should result in at least one Process': function (job) {
                    var pool = job.pool;
                    var pids = _.keys(pool.worker_processes);
                    assert.ok(pids.length > 0);
                    var hp = pool.worker_processes[pids[0]];
                    assert.ok(hp);
                    assert.ok(hp.getPID());
                },
                'to which event handlers are attached': {
                    topic: job_result_topic,
                    'should result in successful events': function (err, result) {
                        assert.deepEqual(result, [
                            [ 'start', undefined ],
                            [ 'progress', 1 ],
                            [ 'progress', 2 ],
                            [ 'progress', 3 ],
                            [ 'success', {
                                options: { thing: 'ohai' },
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
                    topic: job_result_topic,
                    'should result in a failure event': function (err, result) {
                        assert.deepEqual(result.pop(), 
                            ['failure', 'THIS IS A FAILURE']);
                    }
                }
            }
        }
    }
});

suite.addBatch({
    'a Pool with max_job_per_process=4': {
        topic: function () {
            var self = this;
            var processes = {};
            var pool = new hirelings.Pool({
                max_jobs_per_process: MAX_JOBS,
                max_processes: MAX_PROCESSES,
                module: __dirname + '/workers/echo.js',
                options: { thing: 'ohai' }
            });
            // Watch for spawning processes
            pool.on('spawn', function (p) {
                processes[p.getPID()] = 0;
            });
            // Count jobs tasked to processes
            pool.on('task', function (job, p) {
                processes[p.getPID()]++;
            });
            // Queue up an arbitrarily large number of jobs.
            var jobs = [];
            for (var i=0; i < LOTS_OF_JOBS; i++) {
                var job = pool.enqueue({something: "interesting"});
                jobs.push(job);
            }
            // When the Pool has drained, we're done with the topic.
            pool.on('drain', function () {
                self.callback(null, processes, pool, jobs);
            });
        },
        'should result in no processes having performed more than 4 jobs': 
                function (err, processes, pool, jobs) {
            for (pid in processes) {
                var num_jobs = processes[pid];
                assert.ok(num_jobs <= MAX_JOBS,
                    "Process " + pid + " should have performed " + MAX_JOBS +
                    " or less, but performed " + num_jobs);
            }
        }
    }
});

suite.addBatch({
    'a Pool running a sleep worker': {
        topic: function () {
            var $this = this;
            var pool = new hirelings.Pool({
                max_processes: MAX_PROCESSES,
                module: __dirname + '/workers/sleep.js',
                options: { }
            });
            this.jobs_ct = 0;
            pool.on('done', function (job) {
                $this.jobs_ct++;
            });
            return pool;
        },
        'with a Job enqueued and a Process later killed': {
            topic: function (pool) {
                var job = pool.enqueue({delay: 500});
                setTimeout(function () {
                    // HACK: Reaching into guts, but this is unusual
                    job.worker_process._cprocess.kill();
                }, 200);
                return job_result_topic.call(this, job);
            },
            'should gracefully result in a failure': function (result) {
                assert.deepEqual(result.pop(), ['failure', 'exit']);
            }
        },
        'should start with an empty backlog': function (pool) {
            var stats = pool.getStats();
            assert.equal(stats.backlog, 0);
        },
        'that enqueues more Jobs than available Processes': {
            topic: function (pool) {
                var jobs = [];
                for (var i = 0; i < (MAX_PROCESSES * 2); i++) {
                    jobs.push(pool.enqueue({delay: 500}));
                }
                return jobs;
            },
            'should result in a backlog': function (jobs) {
                var stats = jobs[0].pool.getStats();
                assert.ok(stats.backlog > 0);
            },
            'should not result in more workers than maximum': function (jobs) {
                var stats = jobs[0].pool.getStats();
                assert.ok(stats.workers <= MAX_PROCESSES);
            },
            'should result in all workers busy': function (jobs) {
                var stats = jobs[0].pool.getStats();
                assert.equal(MAX_PROCESSES, stats.busy);
            },
            'and aborts some Jobs': {
                topic: function (jobs) {
                    for (var i=0; i<MAX_PROCESSES; i++) {
                        jobs.shift().abort();
                    }
                    return jobs;
                },
                'should result in an empty backlog': function (jobs) {
                    var stats = jobs[0].pool.getStats();
                    assert.equal(stats.backlog, 0);
                },
                'should result in expected number of jobs completed': function (jobs) {
                    var stats = jobs[0].pool.getStats();
                    assert.equal(stats.jobs, this.jobs_ct);
                }
            }
        }
    }
});

suite.addBatch({
    'a Pool running an unreliable worker and retries=6': {
        topic: function () {
            var self = this;
            var pool = new hirelings.Pool({
                max_processes: MAX_PROCESSES,
                module: __dirname + '/workers/unreliable.js',
                retries: MAX_KILLS + 1
            });
            setTimeout(function () { pool.exit(); }, 1000);
            return pool;
        },
        'with jobs enqueued and killed 5 times each': {
            topic: function (pool) {
                var self = this;
                var results = {};

                // Enqueue a bunch of jobs and prepare the paperwork for
                // performing the test.
                for (var i = 0; i < (MAX_PROCESSES * 2); i++) {
                    (function (name) {
                        // Prepare to track status for each job.
                        var result = results[name] = {
                            kills: 0, exits: 0, retries: 0,
                            successes: 0, failures: 0
                        };
                        // Enqueue the job, with a handler tracking end status.
                        var job = pool.enqueue(name, function (err, rv) {
                            if (err) { result.failures++; }
                            else { result.successes++; }
                        });
                        job.on('retry', function () { result.retries++; });
                    }('JOB ' + i));
                }

                // Simulate catastrophe by killing workers upon tasking
                pool.on('task', function (job, worker) {
                    if (results[job.options].kills++ < MAX_KILLS) {
                        // HACK: Reaching into guts, but this is unusual
                        worker._cprocess.kill();
                    }
                });

                /// Count worker exits per job.
                pool.on('exit', function (worker) {
                    if (worker.job) {
                        results[worker.job.options].exits++;
                    }
                });

                // When the pool has drained of jobs, the test is done.
                pool.on('drain', function () {
                    self.callback(null, results);
                });

            },
            'should result in the expected number of exits detected': function (err, results) {
                _.each(results, function (result) {
                    assert.equal(result.exits, MAX_KILLS);
                });
            },
            'should result in the expected number of retries': function (err, results) {
                _.each(results, function (result) {
                    assert.equal(result.retries, MAX_KILLS);
                });
            },
            'should result in success for all jobs': function (err, results) {
                _.each(results, function (result) {
                    assert.equal(result.successes, 1);
                });
            },
            'should result in failure for no jobs': function (err, results) {
                _.each(results, function (result) {
                    assert.equal(result.failures, 0);
                });
            }
        }
    }
});

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
