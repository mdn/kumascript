// ## Kumascript server runner
//
// Command line KumaScript server runner

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    http = require('http'),
    fs = require('fs'),
    net = require('net'),

    _ = require('underscore'),
    
    nconf = require('nconf'),
    winston = require('winston'),

    kumascript = require(__dirname),
    ks_utils = kumascript.utils,
    ks_server = kumascript.server,
    ks_repl = kumascript.repl;

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
    statsd: {
        enabled: false,
        host: '127.0.0.1',
        port: 8125
    },
    server: {
        port: 9080,
        numWorkers: 16,
        workerConcurrency: 4,
        workerTimeout: 1000 * 60 * 10,
        workerMaxJobs: 8,
        workerRetries: 10,
        document_url_template:
            "https://developer.mozilla.org/en-US/docs/{path}?raw=1",
        template_url_template:
            "https://developer.mozilla.org/en-US/docs/en-US/Template:{name}?raw=1",
        template_cache_control: 'max-age=3600'
    },
    repl: {
        enabled: true,
        host: "127.0.0.1",
        port: 9070
    }
};

// ### Initialize configuration
//
// Attempt to load from a prioritized series of configuration files.
//
// 1. Environ var `KUMASCRIPT_CONFIG`
// 2. `kumascript_settings_local.json` in current dir
// 3. `kumascript_settings.json` in current dir
var cwd = process.cwd(),
    conf_fns = [
        cwd + '/kumascript_settings.json',
        cwd + '/kumascript_settings_local.json',
        process.env.KUMASCRIPT_CONFIG
    ];
_.each(conf_fns, function (conf_fn) {
    if (!conf_fn) { return; }
    try { fs.statSync(conf_fn).isFile(); }
    catch (e) { return; }
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

// Make a nicer alias to the default logger
var log = winston;

var statsd = ks_utils.getStatsD({
    statsd_conf: nconf.get('statsd')
});

var server_conf = nconf.get('server');
server_conf.statsd = statsd;

// Start up a server instance.
var port = server_conf.port;
log.info("Worker PID " + process.pid + " starting on port " + port);
var server = new ks_server.Server(server_conf);
server.listen(port);

// Open up a telnet REPL for interactive access to the server.
var repl = null;
var repl_config = nconf.get('repl');
if (repl_config.enabled) {
    repl = new ks_repl.REPL(repl_config, {
        __: _,
        log: log,
        server_conf: server_conf,
        kill: performExit,
        server: server
    });
    repl.listen(repl_config.host, repl_config.port);
}

function performExit () {
    log.info("Master PID " + process.pid + " exiting");
    server.close();
    if (repl) { repl.close(); }
    process.exit(0);
}

// More gracefully handle some common exit conditions...
process.on('SIGINT', function () {
    log.info("Received SIGINT, exiting...");
    performExit();
});
process.on('SIGTERM', function () {
    log.info("Received SIGTERM, exiting...");
    performExit();
});
process.on('uncaughtException', function (err) {
    log.error('uncaughtException:', err.message);
    log.error(err.stack);
    performExit();
});
