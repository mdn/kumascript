#!/usr/bin/env node

var util = require('util'),
    os = require('os'),
    crypto = require('crypto'),
    _ = require('underscore'),
    hirelings = require(__dirname + '/../lib/hirelings');

var leader = new hirelings.Leader({
    concurrency: os.cpus().length * 10,
    module: __dirname + '/worker.js',
    options: { }
});

function stats () {
    util.debug("\tSTATS: " + 
        "backlog=" + leader.backlog.length + " " +
        "hirelings=" + _.keys(leader.hirelings).length + " " +
        "idle=" + _.filter(leader.hirelings, function (h) {
                    return !h.job; 
                  }).length
    );
}

leader
    .on('spawn', function (hp) {
        util.debug("\tSPAWN " + hp.process.pid);
        stats();
    })
    .on('enqueue', function (job) {
        util.debug("\tENQUEUED");
        stats();
    })
    .on('task', function (job, hireling) {
        util.debug("\tTASK");
        stats();
    })
    .on('exit', function (hireling) {
        util.debug("\tEXIT " + hireling.process.pid);
        stats();
    })
    .on('backlog', function (job) {
        util.debug("\tBACKLOG");
        stats();
    })
    .on('drain', function () {
        util.debug("\tDRAIN");
        stats();
        //leader.exit();
    })

function addWork() {
    crypto.randomBytes(16, function(ex, buf) {
        if (ex) throw ex;
        var str = buf.toString('base64');
        leader.enqueue(str)
            .on('failure', function (err) {
                process.stderr.write("to err is lame!  err: " + util.inspect(err) + "\n");
                process.exit(9);
            })
            .on('success', function(r) {
                if (r !== str) {
                    process.stderr.write("string not problerly echo'd.  LAME!\n");
                    process.stderr.write("want/got: " + str + "/" + r + "\n");
                    process.exit(9);
                }
                setTimeout(function () { addWork(); }, 1500);
            });
    });
}

// then you can perform work in parallel
for (var i = 0; i < os.cpus().length * 39; i++) addWork();
