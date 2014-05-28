// The irony is that this worker is very reliable. It's the test that
// introduces process kills.
var util = require('util'),
    _ = require('underscore'),
    hirelings = require(__dirname + '/../../lib/hirelings');

var self = new hirelings.Worker();

self.on('init', function (config) {
    self.ready();
});

self.on('job', function (job) {
    self.start();
    setTimeout(function () {
        self.success(job);
        self.ready();
    }, 100);
});
