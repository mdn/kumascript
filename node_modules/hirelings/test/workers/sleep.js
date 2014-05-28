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
        self.success("Done!");
        setTimeout(function () {
            self.ready();
        }, job.delay);
    }, job.delay);
});
