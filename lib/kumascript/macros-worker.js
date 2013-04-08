// ## KumaScript macro processing worker
//
// This is a computer-cluster worker that processes one macro at a time.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util');
var _ = require('underscore');
var async = require('async');
var hirelings = require('hirelings');
var Memcached = require('memcached');
var ks_utils = require(__dirname + '/utils');
var ks_api = require(__dirname + '/api');
var ks_macros = require(__dirname + '/macros');
var ks_loaders = require(__dirname + '/loaders');

// Quick & dirty mock API object that just logs all method calls.
function CallCatcher (method_names) {
    var catcher = this;
    catcher.calls = [];
    _(method_names).each(function (method_name) {
        catcher[method_name] = function () {
            var args = Array.prototype.slice.call(arguments, 0);
            catcher.calls.push([method_name, args]);
        };
    });
};

var self = new hirelings.Hireling();

var loader;

self.on('init', function (options) {
    var loader_module = require(options.loader.module);
    var loader_class = loader_module[options.loader.class_name];
    var loader_options = options.loader.options;

    loader = new loader_class(loader_options);
});

self.on('job', function (job) {
    var src  = job.src;
    var name = job.token.name;
    var args = job.token.args;
    var ctx  = job.ctx;

    var errors = [];

    // Build API proxy for logging
    var log = new CallCatcher([
        'log', 'debug', 'info', 'warning', 'error', 'critical'
    ]);

    // Common exit point.
    function job_done(err_name, err_details, result) {
        var err = null;
        if (err_name) {
            err = [err_name, {
                error: ''+err_details,
                stack: err_details.stack,
                name: name,
                src: src,
                token: job.token
            }];
        }
        self.success({
            result: result,
            error: err,
            errors: errors,
            log_events: log.calls
        });
    }

    // Very cautiously try to evaluate this macro...
    try {
        var api_ctx = new ks_api.APIContext({
            arguments: args,
            env: ctx.env,
            source: src,
            
            autorequire: self.options.autorequire,
            memcache: self.options.memcache,

            log: log,
            loader: loader,
            errors: errors
        });

        api_ctx.performAutoRequire(function (err) {
            if (err) { return job_done('TemplateLoadingError', err); }
            loader.get(name, function (err, tmpl, cache_hit) {
                if (err) { return job_done('TemplateLoadingError', err); }
                try {
                    tmpl.execute(args, api_ctx, function (err, result) {
                        if (err) { return job_done('TemplateExecutionError', err); }
                        job_done(null, null, result);
                    });
                } catch (exc) {
                    return job_done('TemplateExecutionError', exc);
                }
            });
        });

    } catch (exc) {
        return job_done('TemplateLoadingError', exc);
    }

});
