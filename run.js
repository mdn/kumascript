// ## Kumascript server runner
//
// Command line KumaScript server runner

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    
    nconf = require('nconf'),
    winston = require('winston'),

    kumascript = require(__dirname),
    ks_utils = kumascript.utils,
    ks_server = kumascript.server;

// ### Default configuration settings
// This could go in `kumascript_settings.json` in the parent project.
var DEFAULT_CONFIG = {
    log: {
        console: false,
        file: {
            filename: 'kumascript.log',
            maxsize: 1024 * 100, // 100k
            maxFiles: 5
        }
    },
    server: {
        port: 9080,
        numWorkers: null,
        workerTimeout: 1000 * 60 * 10,
        document_url_template:
            "https://developer.mozilla.org/en-US/docs/{path}?raw=1",
        template_url_template:
            "https://developer.mozilla.org/en-US/docs/en-US/Template:{name}?raw=1"
    }
};

// ### Initialize configuration
//
// Attempt to load from a prioritized series of configuration files.
//
// 1. Environ var `KUMASCRIPT_CONFIG`, because command line options are hard to
//    sling around when we're using [up][]
// 2. `kumascript_settings_local.json` in current dir
// 3. `kumascript_settings.json` in current dir
// 
// [up]: https://github.com/learnboost/up
var cwd = process.cwd(),
    conf_fns = [
        cwd + '/kumascript_settings.json',
        cwd + '/kumascript_settings_local.json',
        process.env.KUMASCRIPT_CONFIG
    ];
_.each(conf_fns, function (conf_fn) {
    if (!conf_fn) { return; }
    // HACK: There's got to be a better way to detect non-existent files.
    try { fs.statSync(conf_fn).isFile(); }
    catch (e) { return; }
    // Don't catch exceptions here, because it will reveal syntax errors in
    // configuration JSON
    nconf.file({ file: conf_fn });
});

// Include the fallback defaults.
nconf.defaults(DEFAULT_CONFIG);

// ### Initialize logging
var log_conf = nconf.get('log');
if (!log_conf.console) {
    winston.remove(winston.transports.Console);
}
if (log_conf.file) {
    // TODO: Need a rotating file logger here!
    winston.add(winston.transports.File, log_conf.file);
}
// TODO: Accept log line format from config?
// TODO: Use [winston-syslog](https://github.com/indexzero/winston-syslog)?

// ### Initialize a server
var server_conf = nconf.get('server'),
    server = new ks_server.Server(server_conf);

// ### Fire up the server, or hand off to manager.
if (require.main === module) {
    var cluster = require('cluster');

    if (cluster.isMaster) {
        var num_workers = server_conf.numWorkers || 
                          require('os').cpus().length;
        var exiting = false;
        var workers = {};

        for (var i = 0; i < num_workers; i++) {
            var worker = cluster.fork();
            workers[worker.pid] = worker;
        }

        cluster.on('death', function(worker) {
            // Make sure not to keep restarting workers while exiting
            if (exiting) { return; }
            console.log('worker ' + worker.pid + ' died');
            delete workers[worker.pid];
            var new_worker = cluster.fork();
            workers[new_worker.pid] = new_worker;
        });

        // See: https://github.com/joyent/node/issues/2060#issuecomment-2767191
        process.on('SIGINT', function () {
            exiting = true;
            console.log("master exiting");
            for (pid in workers) {
                var worker = workers[pid];
                console.log("kill worker " + worker.pid);
                worker.kill();
            };
            process.exit(1);
        });
        
    } else {
        process.on('uncaughtException', function (err) {
            console.error('uncaughtException:', err.message);
            console.error(err.stack);
            process.exit(1);
        });
        server.listen();
    }
}
