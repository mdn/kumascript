// ## KumaScript macro processing
//
// This is where the magic happens, with regards to finding, inventorying, and
// executing macros in content.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var crypto = require('crypto'),
    hirelings = require('hirelings'),
    EventEmitter = require('events').EventEmitter,
    _ = require('underscore'),
    async = require('async'),
    ks_utils = require(__dirname + '/utils'),
    ks_errors = require(__dirname + '/errors');

// Shortcut for current time in millis
function t_now() {
    return (new Date()).getTime();
}

// Load the document parser, from pre-generated JS if available or on the fly
// from the grammar source.
var ks_parser;
try {
    // NOTE: For production, ensure the parser has been generated.
    // `./node_modules/.bin/pegjs lib/kumascript/parser.pegjs`
    ks_parser = require(__dirname + '/parser');
} catch (e) {
    // For dev only, generate parser from source on the fly
    var PEG = require("pegjs"),
        fs = require("fs"),
        ks_parser_fn = __dirname + '/parser.pegjs',
        ks_parser_src = fs.readFileSync(ks_parser_fn, 'utf8'),
    ks_parser = PEG.buildParser(ks_parser_src);
}

// ### MacroProcessor class
var MacroProcessor = ks_utils.Class(EventEmitter, {

    // #### Default options
    default_options: {
        loader: {
            module: __dirname + '/loaders',
            class_name: 'FileLoader',
            options: {
                root_dir: 'macros'
            }
        },
        memcache: null,
        // Max number of macro workers
        numWorkers: 4,
        // Max number of concurrent macro processing jobs per request.
        workerConcurrency: 4,
        // Max number of jobs handled by a worker before exit
        workerMaxJobs: 64,
        // Number of milliseconds to wait before considering a macro timed out
        workerTimeout: 1000 * 60 * 10,
        // Number of times to retry a failed macro
        workerRetries: 3
    },

    initialize: function (options) {
        this.statsd = ks_utils.getStatsD(this.options);
        this.preStartupCheck(options);
    },

    preStartupCheck: function (options) {
        // Check for problems we want to detect before startup.
        // 1. Ensure that we can create a loader instance without throwing
        //    an error. We want errors to appear here, otherwise nothing will
        //    seem amiss until a macro job is submitted and hangs, due to the
        //    hirelings pool trying over and over to restart the failed process.
        this.makeLoader();
    },

    startup: function (next) {
        var $this = this;

        var pool = this.worker_pool = new hirelings.Pool({
            module: __dirname + '/macros-worker.js',
            max_processes: this.options.numWorkers,
            max_jobs_per_process: this.options.workerMaxJobs,
            retries: this.options.workerRetries,
            timeout_working: this.options.workerTimeout,
            options: {
                autorequire: this.options.autorequire,
                loader: this.options.loader,
                memcache: this.options.memcache
            }
        });

        // HACK: Maybe hirelings should support StatsD directly
        ['spawn', 'exit', 'task', 'backlog', 'drain']
            .forEach(function (name) {
                pool.on(name, function () {
                    $this.statsd.increment('workers.pool.' + name);
                    $this.measureWorkers();
                });
            });

        return next();
    },

    shutdown: function (next) {
        if (this.worker_pool) { this.worker_pool.exit(); }
        return next();
    },

    // #### Process macros in content
    process: function (src, ctx, process_done) {
        var $this = this;
        var errors = [];
        var macros = {};

        // Common exit point for processing
        var t_process_start = t_now();
        function _done(errors, src) {
            $this.statsd.timing('macros.t_processing',
                    t_now() - t_process_start);
            if (!errors.length) errors = null;
            return process_done(errors, src);
        }

        // Attempt to parse the document, trap errors
        var tokens = [];
        try { tokens = ks_parser.parse(src); }
        catch (e) {
            errors.push(new ks_errors.DocumentParsingError({
                error: e, src: src
            }));
            return _done(errors, src);
        }

        var autorequire = $this.options.autorequire;
        var templates_to_reload = [];
        if (ctx.env && 'no-cache' == ctx.env.cache_control) {
            // Extract a unique list of template names used in macros.
            var template_names = _.chain(tokens)
                .filter(function (tok) { return 'MACRO' == tok.type; })
                .map(function (tok) { return tok.name; })
                .uniq().value();

            // Templates to flush include those used in macros and
            // autorequired modules
            templates_to_reload = _.union(template_names, _.values(autorequire));
        }

        // Intercept the logger from context, if present.
        var log = null;
        if ('log' in ctx) {
            log = ctx.log;
        }

        // Macro processing queue managing process of sending jobs to the
        // evaluation cluster.
        //
        // Yes, this is an (internal) queue managing submissions to another
        // (external) queue. But, it limits the number of concurrent jobs per
        // document, and tells us when this document's macros are done.
        var macro_q = async.queue(function (hash, q_next) {

            var t_enqueued = t_now();
            var t_started = null;

            var token = macros[hash];
            var work = {token: token, src: src, ctx: ctx};

            var job = $this.worker_pool.enqueue(work, function (err, rv) {

                if (err) {
                    errors.push(new ks_errors.TemplateExecutionError({
                        error: err,
                        stack: '',
                        name: token.name,
                        src: src,
                        token: token
                    }));
                    token.out = '{{ ' + token.name + ' }}';
                } else if (rv.error) {
                    var err_cls = rv.error[0];
                    var err_opts = rv.error[1];
                    errors.push(new ks_errors[err_cls](err_opts));
                    token.out = '{{ ' + token.name + ' }}';
                } else {
                    token.out = rv.result;
                }

                var t_running = t_now() - t_started;

                $this.statsd.timing('macros.t_running.overall', t_running);
                $this.statsd.timing('macros.t_running.by_name.' + token.name,
                                    t_running);
                $this.statsd.timing('macros.t_enqueued', t_now() - t_enqueued);
                $this.statsd.increment('macros.by_name.' + token.name);

                q_next();
            });

            job.on('start', function () {
                t_started = t_now();
            });

            job.on('progress', function (msg) {
                var type = msg.type,
                    args = msg.args;
                switch (type) {
                    case "log":
                        log[args[0]](args[1]);
                        break;
                    case "statsd":
                        $this.statsd[args[0]](args[1]);
                        break;
                }
            });

            job.on('retry', function () {
                $this.statsd.increment('macros.retries.overall');
                $this.statsd.increment('macros.retries.' + token.name);
            });

        }, $this.options.workerConcurrency);

        // Before queueing macros for processing, reload templates (if any)
        $this.reloadTemplates(templates_to_reload, function (err) {

            // Scan through the tokens, queue unique macros for evaluation.
            tokens.forEach(function (token) {
                if ('MACRO' == token.type) {
                    token.hash = $this.hashTokenArgs(token);
                    if (!(token.hash in macros)) {
                        macros[token.hash] = token;
                        macro_q.push(token.hash);
                    }
                }
            });

            // Exit point when the processing queue has drained.
            macro_q.drain = function (err) {
                // Assemble output text by gluing together text tokens and the
                // results of macro evaluation.
                var src_out = _.map(tokens, function (token) {
                    if ('TEXT' == token.type) {
                        return token.chars;
                    } else if ('MACRO' == token.type) {
                        return macros[token.hash].out;
                    }
                }).join('');
                return _done(errors, src_out);
            }

            // If no macros were queued up, jump straight to drain.
            if (0 == macro_q.length()) { macro_q.drain(); }

        });
    },

    // #### Produce a unique hash for macro
    // A macro's unique hash encompasses the template name and the arguments
    hashTokenArgs: function (token) {
        // Hash the macro name and args, to identify unique calls.
        var hash = crypto.createHash('md5').update(token.name);
        if (token.args.length > 0) {
            // Update the hash with arguments, if any...
            if (_.isObject(token.args[0])) {
                // JSON-style args, so stringify the object.
                hash.update(JSON.stringify(token.args));
            } else {
                // Otherwise, this is a simple string list.
                hash.update(token.args.join(','));
            }
        }
        return hash.digest('hex');
    },

    // #### Force-reload the named templates, if any.
    reloadTemplates: function (names, done) {
        if (0 == names.length) {
            return done();
        }
        try {
            var loader = this.makeLoader();
            async.forEach(names, function (name, e_next) {
                loader.get(name, e_next);
            }, done);
        } catch (e) {
            done(e);
        }
    },

    // #### Record some measurements from the worker pool.
    measureWorkers: function () {
        var stats = this.worker_pool.getStats();
        this.statsd.gauge('workers.total', stats.workers);
        this.statsd.gauge('workers.busy', stats.busy);
        this.statsd.gauge('workers.backlog', stats.backlog);
    },

    makeLoader: function () {
        var loader_module = require(this.options.loader.module);
        var loader_class = loader_module[this.options.loader.class_name];
        var loader_options = _.clone(this.options.loader.options);

        // Use a Cache-Control header that forces a fresh cache.
        loader_options.cache_control = 'no-cache';
        loader_options.statsd = this.statsd;

        return new loader_class(loader_options);
    }

});

// ### Exported public API
module.exports = {
    MacroProcessor: MacroProcessor
};
