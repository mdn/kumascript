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
        process.env.KUMASCRIPT_CONFIG,
        cwd + '/kumascript_settings_local.json',
        cwd + '/kumascript_settings.json'
    ];
_.each(conf_fns, function (conf_fn) {
    try {
        if (conf_fn && fs.statSync(conf_fn).isFile()) {
            nconf.file({ file: conf_fn });
        }
    } catch (e) { }
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
    // If this has been executed as a script directly, fire up the server.
    server.listen();
} else {
    // Otherwise, export the server instance. Useful for [up][]
    // [up]: https://github.com/learnboost/up
    module.exports = server.app;
}
