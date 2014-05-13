var hirelings = require(__dirname + '/../../lib/hirelings');

var self = new hirelings.Worker();

self.on('init', function (config) {
    self.ready();
});

self.on('job', function (job) {
    self.start();
    self.success({
        options: self.options,
        job: job
    });
    self.ready();
});
