// ## Kumascript server runner
//
// Command line KumaScript server runner

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var _ = require('underscore'),
    winston = require('winston'),

    kumascript = require(__dirname),
    ks_conf = kumascript.conf,
    ks_utils = kumascript.utils,
    ks_server = kumascript.server,
    ks_repl = kumascript.repl;

// ### Initialize logging
var log_conf = ks_conf.nconf.get('log');
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
    statsd_conf: ks_conf.nconf.get('statsd')
});

var server_conf = ks_conf.nconf.get('server');
server_conf.statsd = statsd;

// Start up a server instance.
var port = server_conf.port;
log.info("Worker PID " + process.pid + " starting on port " + port);
var server = new ks_server.Server(server_conf);
server.listen(port);

// Open up a telnet REPL for interactive access to the server.
var repl = null;
var repl_config = ks_conf.nconf.get('repl');
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
