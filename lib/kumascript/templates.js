// ## KumaScript template scripts
//
// This module houses the abstractions for compiling and executing template
// scripts

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var vm = require("vm"),
    _ = require('underscore'),
    Fiber = require('fibers'),
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
        var ejs = require('ejs');
        this.compiled = ejs.compile(this.options.source);
    },
    execute: function (args, ctx, next) {
        var compiled = this.compiled;
        Fiber(function () {
            var result,
                success = false;
            try {
                result = compiled(ctx);
                success = true;
            } catch (e) {
                next(e, '');
            }
            if (success) {
                next(null, result.trim());
            }
        }).run();
    }
});

// ### Exported public API
module.exports = {
    BaseTemplate: BaseTemplate,
    JSTemplate: JSTemplate,
    EJSTemplate: EJSTemplate
};
