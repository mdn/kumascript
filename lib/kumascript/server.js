// ## KumaScript HTTP service
//
// Provides the HTTP service for document processing

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    crypto = require('crypto'),

    _ = require('underscore'),
    
    request = require('request'),
    Memcached = require('memcached'),
    express = require('express'),
    log = require('winston'),
    firelogger = require('firelogger'),

    ks_loaders = require(__dirname + '/loaders'),
    ks_caching = require(__dirname + '/caching'),
    ks_macros = require(__dirname + '/macros'),
    ks_templates = require(__dirname + '/templates'),
    ks_api = require(__dirname + '/api'),
    ks_utils = require(__dirname + '/utils');


// ### Server
//
// KumaScript service instance.
var Server = ks_utils.Class({

    // Service accepts these options:
    default_options: {
        // Port on which the HTTP service will listen.
        port: 9000,
        // Template used to resolve incoming URL paths to document source URLs.
        document_url_template: "http://localhost:9001/docs/{path}?raw=1",
        // Template used to resolve macro names to URLs for the loader.
        template_url_template: "http://localhost:9001/templates/{name}?raw=1",
        // Default cache-control header to send with HTTP loader
        template_cache_control: "max-age=3600",
        // Prefix used in headers intended for env variables
        env_header_prefix: 'x-kumascript-env-',
        // Max number of macro workers
        numWorkers: 16,
        // Max number of concurrent macro processing jobs per request.
        workerConcurrency: 4,
        // Max number of jobs handled by a worker before exit
        workerMaxJobs: 64,
        // Number of milliseconds to wait before considering a macro timed out
        workerTimeout: 1000 * 60 * 10,
    },

    // Build the service, but do not listen yet.
    initialize: function (options) {
        var $this = this,
            app = this.app = express.createServer();

        this.req_cnt = 0;

        if (this.options.memcache) {
            var mo = this.options.memcache;
            this.memcached = new Memcached(mo.server, mo.options || {});
        } else {
            // If the configuration is missing, use the fake stub cache
            this.memcached = new ks_utils.FakeMemcached();
        }

        if (this.options.macro_processor) {
            this.macro_processor = this.options.macro_processor;
        } else {
            this.macro_processor = new ks_macros.MacroProcessor({ 
                autorequire: this.options.autorequire,
                memcache: this.options.memcache,
                loader: {
                    module: __dirname + '/loaders',
                    class_name: 'HTTPLoader',
                    options: {
                        memcache: this.options.memcache,
                        url_template: this.options.template_url_template,
                        cache_control: this.options.template_cache_control
                    }
                }
            });
        }

        $this.macro_processor.startup(function () { 
            // Configure the HTTP server...
            app.configure(function () {
                // Configure a logger that pipes to the winston logger.
                app.use(express.logger({
                    format: ':remote-addr - - [:date] ":method :url ' +
                            'HTTP/:http-version" :status :res[content-length] ' +
                            '":referrer" ":user-agent" :response-time',
                    stream: {
                        write: function(s) {
                            log.info(s.trim(), {
                                source: "server",
                                pid: process.pid
                            });
                        }
                    }
                }));
                app.use(firelogger());
            });

            // Set up HTTP routing, pretty simple so far...
            app.get('/docs/*', _.bind($this.docs_GET, $this));
            app.post('/docs/', _.bind($this.docs_POST, $this));
        });
    },

    // Start the service listening
    listen: function (port) {
        port = port || this.options.port;
        this.app.listen(port);
    },

    // Close down the service
    close: function () {
        var $this = this;
        $this.macro_processor.shutdown(function () {
            $this.app.close();
        });
    },

    // #### GET /docs/*
    //
    // Process source documents, respond with the result of macro evaluation.
    docs_GET: function (req, res) {
        var $this = this,
            opts = {};

        // Vary caching on values of env vars, as well as X-FireLogger
        var pfx = this.options.env_header_prefix;
        var vary = _.chain(req.headers).keys().filter(function (key) {
            return 0 === key.indexOf(pfx);
        }).value();
        vary.push('X-FireLogger');
        res.header('Vary', vary.join(','));

        // Create a response cache instance
        var cache = new ks_caching.ResponseCache({
            memcache: this.options.memcache,
        });
        cache.cacheResponse(req, res, opts, function (req, res) {
            var path = req.params[0],
                url_tmpl = $this.options.document_url_template,
                doc_url = ks_utils.tmpl(url_tmpl, {path: path});

            var req_opts = {
                memcached: $this.memcached,
                timeout: $this.options.cache_timeout || 3600,
                cache_control: req.header('cache-control'),
                url: doc_url,
            };
            ks_caching.request(req_opts, function (err, resp, src) {
                $this._evalMacros(src, req, res);
            });
        });
    },

    // #### POST /docs/
    //
    // Process POST body, respond with result of macro evaluation
    docs_POST: function (req, res) {
        var $this = this,
            buf = '';
        
        // TODO: Be more flexible with encodings.
        req.setEncoding('utf8');
        req.on('data', function (chunk) { buf += chunk; });
        req.on('end', function () {
            try {
                var src = buf.length ? buf : '';
                $this._evalMacros(src, req, res);
            } catch (err){
                // TODO: Handle errors more gracefully
                $this._evalMacros('', req, res);
            }
        });
    },

    // #### _evalMacros()
    //
    // Shared macro evaluator used by GET and POST
    _evalMacros: function (src, req, res) {
        var $this = this;
        try {
            var request_id = req.headers['x-request-id'] ||
                ('w-' + process.pid + '-' + $this.req_cnt++);

            // Extract env vars from request headers
            var pfx = this.options.env_header_prefix;
            var env = _.chain(req.headers).map(function (val, key) {
                try {
                    if (0 !== key.indexOf(pfx)) { return; }
                    var d_key = key.substr(pfx.length),
                        d_json = (new Buffer(val, 'base64'))
                                  .toString('utf-8'),
                        data = JSON.parse(d_json);
                    return [d_key, data];
                } catch (e) {
                    // No-op, ignore parsing errors for env vars
                }
            }).object().value();

            var cc = req.header('cache-control') || '';
            env.cache_control = cc;
            if (cc.indexOf('no-cache') != -1) {
                env.revalidate_at = (new Date()).getTime();
            }

            var ctx = {
                env: env,
                log: res.log
            };

            // Process the macros...
            this.macro_processor.process(src, ctx, function (errors, result) {
                if (errors) {
                    errors.forEach(function (error) {
                        delete error.options.src;
                        res.log.error(error.message, { 
                            name: 'kumascript',
                            template: '%s: %s',
                            args: [error.name, error.message, error.options]
                        });
                    });
                }
                res.send(result);
            });

        } catch (error) {
            res.log.error(error.message, { 
                name: 'kumascript',
                template: '%s: %s',
                args: [error.name, error.message, error.options]
            });
            // HACK: If all else fails, send back the source
            res.send(src);
        }
    }

});

// ### Exported public API
module.exports = {
    Server: Server
};
