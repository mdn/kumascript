// ## KumaScript HTTP service
//
// Provides the HTTP service for document processing

/*jshint node: true, esversion: 6, expr: false, boss: true */

var ks_conf = require(__dirname + '/conf');

var newrelic_conf = ks_conf.nconf.get('newrelic');
if (newrelic_conf && newrelic_conf.license_key) require('newrelic');

// ### Prerequisites
var url = require('url'),
    _ = require('underscore'),
    request = require('request'),
    Memcached = require('memcached'),
    express = require('express'),
    morgan = require('morgan'),
    log = require('winston'),
    firelogger = require(__dirname + '/firelogger'),
    ks_caching = require(__dirname + '/caching'),
    ks_macros = require(__dirname + '/macros'),
    ks_utils = require(__dirname + '/utils');


// ### Server
//
// KumaScript service instance.
var Server = ks_utils.Class({

    // Service accepts these options:
    default_options: {
        // Boolean switch to control logging.
        logging: true,
        // Port on which the HTTP service will listen.
        port: 9000,
        // Template used to resolve incoming URL paths to document source URLs.
        document_url_template: "http://localhost:9001/docs/{path}?raw=1",
        // Template used to resolve macro names to URLs for the loader.
        template_url_template: "http://localhost:9001/templates/{name}?raw=1",
        // Root dir (relative) from which to load macros for the loader.
        template_root_dir: "macros",
        // Default cache-control header to send with HTTP loader
        template_cache_control: "max-age=3600",
        // Prefix used in headers intended for env variables
        env_header_prefix: 'x-kumascript-env-',
        // Max number of loader retries.
        loader_max_retries: 5,
        // Time to wait between loader retries.
        loader_retry_wait: 100,
        // Max number of macro workers
        numWorkers: 16,
        // Max number of concurrent macro processing jobs per request.
        workerConcurrency: 4,
        // Max number of jobs handled by a worker before exit
        workerMaxJobs: 64,
        // Number of milliseconds to wait before considering a macro timed out
        workerTimeout: 1000 * 60,
        // Number of times to retry a macro
        workerRetries: 3
    },

    // Build the service, but do not listen yet.
    initialize: function (options) {
        var $this = this,
            app = this.app = express();

        this.req_cnt = 0;

        this.statsd = ks_utils.getStatsD(this.options);

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
            var mp_options = _.extend(_.clone(this.options), {
                autorequire: this.options.autorequire,
                memcache: this.options.memcache,
                statsd: this.options.statsd,
                loader: {
                    module: __dirname + '/loaders',
                    class_name: 'FileLoader',
                    options: {
                        memcache: this.options.memcache,
                        statsd_conf: this.options.statsd_conf,
                        url_template: this.options.template_url_template,
                        cache_control: this.options.template_cache_control,
                        root_dir: this.options.template_root_dir,
                        max_retries: this.options.loader_max_retries,
                        retry_wait: this.options.loader_retry_wait
                    }
                }
            });
            this.macro_processor = new ks_macros.MacroProcessor(mp_options);
        }

        $this.macro_processor.startup(function () {
            // Configure the HTTP server...
            if ($this.options.logging) {
                // Configure a logger that pipes to the winston logger.
                var logger = morgan(
                    ':remote-addr - - [:date] ":method :url ' +
                    'HTTP/:http-version" :status :res[content-length] ' +
                    '":referrer" ":user-agent" :response-time',
                    {
                        stream: {
                            write: function(s) {
                                log.info(s.trim(), {
                                    source: "server",
                                    pid: process.pid
                                });
                            }
                        }
                    }
                );
                app.use(logger);
            }
            app.use(firelogger());
            // Set up HTTP routing, pretty simple so far...
            app.get('/', _.bind($this.root_GET, $this));
            app.get('/docs/*', _.bind($this.docs_GET, $this));
            app.post('/docs/', _.bind($this.docs_POST, $this));
            app.get('/macros/?', _.bind($this.macros_list_GET, $this));
            app.get('/healthz/?', _.bind($this.liveness_GET, $this));
            app.get('/readiness/?', _.bind($this.readiness_GET, $this));
        });
    },

    // Start the service listening
    listen: function (port) {
        port = port || this.options.port;
        this.server = this.app.listen(port);
    },

    // Close down the service
    close: function () {
        var $this = this;
        $this.macro_processor.shutdown(function () {
            if ($this.server) {
                $this.server.close();
            }
        });
    },

    // #### GET /
    //
    // Return something
    root_GET: function (req, res) {
        res.send('<html><body><p>Hello from KumaScript!</p></body></html>');
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
        res.set('Vary', vary.join(','));

        // Create a response cache instance
        var cache = new ks_caching.ResponseCache({
            memcache: this.options.memcache,
            statsd: $this.statsd,
        });
        cache.cacheResponse(req, res, opts, function (req, res) {
            var path = req.params[0],
                url_tmpl = $this.options.document_url_template,
                doc_url = ks_utils.tmpl(url_tmpl, {path: encodeURI(path)});

            var req_opts = {
                memcached: $this.memcached,
                statsd: $this.statsd,
                timeout: $this.options.cache_timeout || 3600,
                cache_control: req.get('cache-control'),
                url: doc_url,
            };
            ks_caching.request(req_opts, function (err, resp, src) {
                if (err) {
                    res.log.error('Problem fetching source document: ' + err.message, {
                        name: 'kumascript',
                        template: '%s: %s',
                        args: [err.name, err.message, err.options]
                    });
                    res.send('');
                } else {
                    $this._evalMacros(src, req, res);
                }
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

    // #### GET /macros
    //
    // Get JSON of available macros (also known as templates)
    macros_list_GET: function (req, res) {
        var loader = this.macro_processor.makeLoader(),
            loader_name = this.macro_processor.options.loader.class_name,
            data = loader.macros_data();
        data.loader = loader_name;
        res.json(data);
    },

    /**
     * A "liveness" endpoint for use by Kubernetes or other
     * similar systems. A successful response from this endpoint
     * simply proves that this Express app is up and running. It
     * doesn't mean that its supporting services (like the macro
     * loader and the document service) can be successfully used
     * from this service.
     */
    liveness_GET: function (req, res) {
        res.sendStatus(204);
    },

    /**
     * A "readiness" endpoint for use by Kubernetes or other
     * similar systems. A successful response from this endpoint goes
     * a step further and means not only that this Express app is up
     * and running, but also that one or more macros have been found
     * and that the document service is ready.
     */
    readiness_GET: function (req, res) {
        var msg = 'service unavailable ',
            parts = url.parse(this.options.document_url_template),
            kumaReadiness = `${parts.protocol}//${parts.host}/readiness`;

        // First, check that we can load some macros.
        try {
            // If there are no macros or duplicate macros, an error
            // will be thrown.
            this.macro_processor.makeLoader();
        } catch(err) {
            msg += `(macro loader error) (${err})`;
            res.status(503).send(msg);
            return;
        }

        // Finally, check that the document service is ready.
        request.get(kumaReadiness, function (err, resp, body) {
            if (!err && ((resp.statusCode >= 200) && (resp.statusCode < 400))) {
                res.sendStatus(204);
            } else {
                var reason = err ? err : body;
                msg += `(document service is not ready) (${reason})`;
                res.status(503).send(msg);
            }
        });
    },

    // #### _evalMacros()
    //
    // Shared macro evaluator used by GET and POST
    _evalMacros: function (src, req, res) {
        try {
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

            var cc = req.get('cache-control') || '';
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
