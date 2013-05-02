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

var self = new hirelings.Worker();

// Quick & dirty mock API that just relays all calls as progress to parent
function ProgressRelay (self, type, method_names) {
    var catcher = this;
    _(method_names).each(function (method_name) {
        catcher[method_name] = function () {
            var args = Array.prototype.slice.call(arguments, 0);
            self.progress({type: type, args: [method_name, args]});
        };
    });
};

var log = new ProgressRelay(self, 'log', [
    'log', 'debug', 'info', 'warning', 'error', 'critical'
]);
var statsd = new ProgressRelay(self, 'statsd', [
    'timing', 'increment', 'decrement', 'gauge', 'update_stats'
]);

var loader;

self.on('init', function (options) {
    statsd.increment('workers.init');

    var loader_module = require(options.loader.module);
    var loader_class = loader_module[options.loader.class_name];
    var loader_options = options.loader.options;

    loader_options.statsd = statsd;

    loader = new loader_class(loader_options);
});

self.on('job', function (job) {
    statsd.increment('workers.accept_job');

    var src  = job.src;
    var name = job.token.name;
    var args = job.token.args;
    var ctx  = job.ctx;

    var errors = [];

    var se_pre = 'macros.errors.';

    // Very cautiously try to evaluate this macro...
    try {
        var api_ctx = new ks_api.APIContext({
            arguments: args,
            env: ctx.env,
            source: src,
            
            loader: loader,
            autorequire: self.options.autorequire,
            memcache: self.options.memcache,

            log: log,
            statsd: statsd,
            errors: errors
        });
        
        // Common exit point.
        function _exit(err_name, err_details, result) {
            statsd.increment('macros.processed');
            var err = null;
            if (err_name) {
                err = [err_name, {
                    error: ''+err_details, stack: err_details.stack,
                    name: name, src: src, token: job.token
                }];
            }
            self.success({result: result, error: err, errors: errors});
        }

        api_ctx.performAutoRequire(function (err) {
            if (err) {
                statsd.increment(se_pre + '.autorequire');
                return _exit('TemplateLoadingError', err);
            }
            loader.get(name, function (err, tmpl, cache_hit) {
                if (err) {
                    statsd.increment(se_pre + 'loading.overall');
                    statsd.increment(se_pre + 'loading.by_name.' + name);
                    return _exit('TemplateLoadingError', err);
                }
                try {
                    tmpl.execute(args, api_ctx, function (err, result) {
                        if (err) {
                            statsd.increment(se_pre + 'exec.overall');
                            statsd.increment(se_pre + 'exec.by_name.' + name);
                            return _exit('TemplateExecutionError', err); 
                        }
                        _exit(null, null, result);
                    });
                } catch (exc) {
                    statsd.increment(se_pre + 'exec.overall');
                    statsd.increment(se_pre + 'exec.by_name.' + name);
                    return _exit('TemplateExecutionError', exc);
                }
            });
        });

    } catch (exc) {
        statsd.increment(se_pre + 'loading.overall');
        return _exit('TemplateLoadingError', exc);
    }

});
