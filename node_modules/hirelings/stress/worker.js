var util = require('util'),
    crypto = require('crypto'),
    hirelings = require(__dirname + '/../lib/hirelings');

var self = new hirelings.Hireling();
self.on('job', function (job) {
    util.debug('[' + process.pid + '] ' + job);
    setTimeout(function () {
        self.success(job); 
    }, 500);
});
