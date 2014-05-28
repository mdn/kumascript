var util = require('util');
var hirelings = require(__dirname + '/../../lib/hirelings');

var self = new hirelings.Worker();

self.on('init', function (config) {
    setTimeout(function () {
        self.ready();
    }, 200);
});

self.on('job', function (job) {
    setTimeout(function () {
        self.start();
        setTimeout(function () {
            self.success(job);
            setTimeout(function () {
                self.ready();
            }, 200);
        }, 200);
    }, 200);
});
