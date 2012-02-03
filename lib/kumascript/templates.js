// ## KumaScript template scripts
//
// This module houses the abstractions for compiling and executing template
// scripts

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    vm = require("vm"),
    _ = require('underscore'),
    // This also injects `Fiber` and `yield`
    fibers = require('fibers'),
    Future = require('fibers/future'),
    wait = Future.wait,
    ks_utils = require(__dirname + '/utils');

// ### BaseTemplate
//
// The base template script class
var BaseTemplate = ks_utils.Class({

    default_options: {
        // Templates compile from textual source
        source: ''
    },

    // #### execute
    //
    // Execute the template with the given arguments. The callback should expect
    // `(err, result)` parameters.
    execute: function (args, ctx, next) {
        next(null, "UNIMPLEMENTED");
    }

});

// ### JSTemplate
//
// Template executed using sandboxed JS
var JSTemplate = ks_utils.Class(BaseTemplate, {
    initialize: function (options) {
        BaseTemplate.prototype.initialize.apply(this, arguments);
        var vm = require("vm");
        this.script = vm.createScript(this.options.source);
    },
    execute: function (args, ctx, next) {
        var script = this.script,
            content = [],
            t_ctx = _.extend({
                "arguments": args,
                out: function (s) { content.push(s); }
            }, ctx);
        Fiber(function () {
            script.runInNewContext(t_ctx);
            next(null, content.join(''));
        }).run();
    }
});

// ### EJSTemplate
//
// Template executed using EJS
var EJSTemplate = ks_utils.Class(BaseTemplate, {
    initialize: function (options) {
        BaseTemplate.prototype.initialize.apply(this, arguments);
        this.compiled = require('ejs').compile(this.options.source);
    },
    execute: function (args, ctx, next) {
        var vm = require("vm"),
            compiled = this.compiled,
            t_ctx = _.extend({
                "arguments": args
            }, ctx);
        Fiber(function () {
            var result = compiled(t_ctx);
            next(null, result.trim());
        }).run();
    }
});

// ### Exported public API
module.exports = {
    BaseTemplate: BaseTemplate,
    JSTemplate: JSTemplate,
    EJSTemplate: EJSTemplate
};
