// ## Kumascript server runner
//
// Command line KumaScript server runner

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    fs = require('fs'),
    net = require('net'),
    repl = require('repl'),
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

// Make a nicer alias to the default logger
var log = winston;

// ### Initialize a server
var server_conf = nconf.get('server');

function startWorker() {
    log.info("Worker PID " + process.pid + " starting");
    process.on('uncaughtException', function (err) {
        log.error('uncaughtException:', err.message);
        log.error(err.stack);
        process.exit(1);
    });
    var server = new ks_server.Server(server_conf);
    server.listen();
}

function startMaster() {
    log.info("Master PID " + process.pid + " starting");

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
        log.info('Worker ' + worker.pid + ' died');
        delete workers[worker.pid];
        var new_worker = cluster.fork();
        workers[new_worker.pid] = new_worker;
    });

    // Kill the master and all workers. If this is being monitored at the
    // OS level, the whole thing should restart.
    function performExit () {
        exiting = true;
        log.info("Master exiting...");
        for (pid in workers) {
            var worker = workers[pid];
            worker.kill();
            log.info("Killed worker " + worker.pid);
        };
        process.exit(1);
    }

    // See: https://github.com/joyent/node/issues/2060#issuecomment-2767191
    process.on('SIGINT', performExit);

    // Open up a telnet REPL for interactive access to the server.
    var repl_config = nconf.get('repl');
    if (repl_config.enabled) {
        // TODO: Move this off into its own repl.js module?

        // Things to expose to the REPL
        var context = {
            __: _,
            log: log,
            server_conf: server_conf,
            workers: workers,

            // Force-exit the master, which hopefully gets restarted by an
            // OS-level monitor like supervisor.
            kill: performExit,

            // Kill all the workers and let the master restart them. More
            // forgiving than kill()
            restart: function () {
                log.info("Recycling workers...");
                var killed = [];
                for (pid in workers) {
                    var worker = workers[pid];
                    worker.kill();
                    log.info("Killed worker " + worker.pid);
                    killed.push(pid);
                };
                return killed;
            }
        };

        // REPL eval handler that logs all commands
        // Cribbed from https://github.com/joyent/node/blob/v0.6/lib/repl.js#L76
        var vm = require('vm');
        var eval = function(code, context, file, cb) {
            log.info("REPL (cmd): > " + util.inspect(code));
            var err, result;
            try {
                result = vm.runInContext(code, context, file);
            } catch (e) {
                err = e;
            }
            log.info("REPL (result): " + util.inspect([err, result]));
            cb(err, result);
        };

        // Finally, set up the server to accept REPL connections.
        var host = repl_config.host;
        var port = repl_config.port;
        net.createServer(function (socket) {
            var r_host = socket.remoteAddress;
            var r_port = socket.remotePort;
            var shell = repl.start("ks> ", socket, eval);
            _(shell.context).extend(context);
            log.info("REPL received connection from "+r_host+":"+r_port); 
            socket.on('close', function () {
                log.info("REPL connection closed for "+r_host+":"+r_port);
            });
        }).listen(port, host)
        log.info("Telnet REPL interface started on " + host + ":" + port);
    }

}

// Fire up the master or the worker, as appropriate.
var cluster = require('cluster');
if (!cluster.isMaster) {
    startWorker();
} else {
    startMaster();
}
