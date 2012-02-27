// ## Kumascript server runner
//
// Command line KumaScript server runner

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    
    nconf = require('nconf'),
    optimist = require('optimist'),
    winston = require('winston'),

    kumascript = require(__dirname),
    ks_utils = kumascript.utils,
    ks_server = kumascript.server;

// ### Default configuration settings
var DEFAULT_CONFIG = {
    log_filename: 'kumascript.log',
    port: 9080,
    document_url_template:
        "https://developer.mozilla.org/en-US/docs/{path}",
    template_url_template:
        "https://developer.mozilla.org/en-US/docs/Template:{path}"
};

// Evil module-global argv
var argv;

// ### Main driver
function main() {
    handleOptions();
    initConfig();
    initLogging();
    return buildServer();
}

// ### Handle command line options
function handleOptions () {
    // Crazy optimist chaining sugar ahoy!
    optimist
        .options({
            'help': {
                describe: 'Display this help message',
                boolean: true
            },
            'verbose': {
                describe: 'Verbose console logging output',
                boolean: true,
                alias: 'v'
            },
            'config': {
                describe: 'Specify configuration file',
            },
            'port': {
                describe: 'Port for HTTP service (default 9080)',
            }
        })
        .usage([
            'Run the KumaScript service',
            'Usage: $0',
        ].join("\n"));

    // Capture the parsed options
    argv = optimist.argv;
    if (argv.help || argv.h) {
        // Punt out to the help message, if requested.
        optimist.showHelp();
        process.exit(1);
    }
}

// ### Initialize configuration
function initConfig () {
    // Load first from environment and command line
    nconf.env().argv();
    // Load from file, based on --config option
    if (argv.config) {
        nconf.file({ file: argv.config });
    }
    // Defaults, if all else fails.
    nconf.defaults(DEFAULT_CONFIG);
}

// ### Initialize logging
function initLogging () {
    if (!(argv.verbose || argv.v)) {
        winston.remove(winston.transports.Console);
        winston.add(winston.transports.File, {
            filename: nconf.get('log_filename')
        });
    } else {
    }
}

// ### Build the server.
function buildServer () {
    // Build server config object from nconf.get()'s
    var server_conf = _
        .chain(ks_server.Server.prototype.default_options)
        .keys().map(function (n) { return [n, nconf.get(n)]; })
        .object().value();
    // Return a configured server.
    return new ks_server.Server(server_conf);
}

if (require.main === module) {
    // If this has been executed as a script directly, fire up the server.
    main().listen();
} else {
    // Otherwise, export the server instance. Useful for [up][]
    // [up]: https://github.com/learnboost/up
    module.exports = main().app;
}
