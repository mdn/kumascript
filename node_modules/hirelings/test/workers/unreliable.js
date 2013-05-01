var util = require('util'),
    _ = require('underscore'),
    hirelings = require(__dirname + '/../../lib/hirelings');

var self = new hirelings.Worker();

self.on('job', function (job) {
    // The irony is, this worker is very reliable. It's the test that
    // introduces process kills.
    setTimeout(function () { self.success(job); }, 100);
});
