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
        // kumascript.templates class used to render templates
        template_class: 'EJSTemplate',
        // kumascript.loaders class used to load templates
        template_loader_class: 'HTTPLoader',
        // Prefix used in headers intended for env variables
        env_header_prefix: 'x-kumascript-env-',
        // Number of milliseconds to wait before considering a macro timed out
        macro_timeout: 120000
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
        app.get('/docs/*', _.bind(this.docs_GET, this));
        app.post('/docs/', _.bind(this.docs_POST, this));
    },

    // Start the service listening
    listen: function (port) {
        port = port || this.options.port;
        this.app.listen(port);
    },

    // Close down the service
    close: function () {
        this.app.close();
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
            memcache: this.options.memcache
        });
        cache.cacheResponse(req, res, opts, function (req, res) {
            var path = req.params[0],
                url_tmpl = $this.options.document_url_template,
                doc_url = ks_utils.tmpl(url_tmpl, {path: path});

            var req_opts = {
                memcached: $this.memcached,
                timeout: $this.options.cache_timeout || 3600,
                cache_control: req.header('cache-control'),
                url: doc_url
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
            var env_vars = _.chain(req.headers).map(function (val, key) {
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

            // Build the API context
            var api_ctx = new ks_api.APIContext({
                server_options: $this.options,
                env: env_vars,
                source: src,
                log: res.log
            });

            var macro_processor;
            if (this.macro_processor) {
                // Mostly for tests: If a macro_processor has been set for the
                // server, use it.
                macro_processor = _(this.macro_processor).clone();
            } else {
                // Get a class for rendering templates
                var template_name = this.options.template_class,
                    template_class = ks_templates[template_name] ||
                                     ks_templates.EJSTemplate;

                // Get a class for loading templates
                var loader_name = this.options.template_loader_class,
                    template_loader_class = ks_loaders[loader_name] ||
                                            ks_loaders.HTTPLoader;

                // Instantiate the macro processor
                var macro_processor = new ks_macros.MacroProcessor({
                    loader_class: template_loader_class,
                    loader_options: {
                        memcache: this.options.memcache,
                        url_template: this.options.template_url_template,
                        template_class: template_class
                    },
                    macro_timeout: this.options.macro_timeout
                });
            }

            // Wire up event listeners to shout up to a master process, if any.
            _(['start', 'end', 'error', 'templateLoaded', 'macroStart', 'macroEnd'])
                .each(function (ev_name, idx) {
                    macro_processor.on(ev_name, function (message) {
                        if ('send' in process) process.send({
                            request_id: request_id,
                            name: ev_name,
                            message: message
                        });
                    });
                });

            // Process the macros...
            macro_processor.process(src, api_ctx, function (errors, result) {
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
