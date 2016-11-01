var _ = require('underscore'),
    fs = require('fs'),
    nconf = require('nconf');

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
    newrelic: {
        high_security: true,
        app_name: ['developer-local.allizom.org-kumascript'],
        license_key: '',
        logging: {
            level: 'info'
        }
    },
    server: {
        port: 9080,
        numWorkers: 4,
        workerConcurrency: 4,
        workerTimeout: 1000 * 60,
        workerMaxJobs: 8,
        workerRetries: 3,
        document_url_template:
            "https://developer.mozilla.org/en-US/docs/{path}?raw=1",
        template_url_template:
            "https://developer.mozilla.org/en-US/docs/Template:{name}?raw=1",
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
// Load from environment
// Use '__' as separator
// server__port=9080
nconf.env('__');

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

module.exports = {
    nconf: nconf
};
