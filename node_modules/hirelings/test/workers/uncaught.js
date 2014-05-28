var util = require('util'),
    _ = require('underscore'),
    hirelings = require(__dirname + '/../../lib/hirelings');

var self = new hirelings.Worker();

self.on('init', function (config) {
    self.ready();
});

var someAPI = {};

self.on('job', function (job) {
    self.start();
    var value = someAPI.thisMethodDoesNotExist();
    self.success(value);
    self.ready();
});
