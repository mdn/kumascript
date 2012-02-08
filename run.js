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
    startServer();
}

// ### Handle command line options
function handleOptions () {
    // Crazy optimist chaining sugar ahoy!
    optimist
        .options('help', {
            describe: 'Display this help message',
            boolean: true
        })
        .options('verbose', {
            describe: 'Verbose console logging output',
            boolean: true,
            alias: 'v'
        })
        .options('config', {
            describe: 'Specify configuration file',
        })
        .options('port', {
            describe: 'Port for HTTP service (default 9080)',
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

// ### Start the server.
function startServer () {
    // Build simple server conf object from nconf.get()'s
    var server_conf = _.chain([
        'port',
        'document_url_template',
        'template_url_template'
    ]).map(function (n) {
        return [n, nconf.get(n)];
    }).object().value();

    // Fire up the service.
    var server = new ks_server.Server(server_conf);
    server.listen();
}

// Finally, kick off the main driver.
main();
