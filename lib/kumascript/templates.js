// ## KumaScript template scripts
//
// This module houses the abstractions for compiling and executing template
// scripts

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),
    ks_utils = require(__dirname + '/utils');

// ### BaseTemplate
//
// The base template script class
var BaseTemplate = ks_utils.Class({

    // #### execute(args, next)
    //
    // Execute the template with the given arguments. The callback should expect
    // `(err, result)` parameters.
    execute: function (args, next) {
        next(null, "UNIMPLEMENTED");
    }

});

// ### JSTemplate
//
// Template executed using sandboxed JS
var JSTemplate = ks_utils.Class(BaseTemplate, {
    default_options: {
        source: ''
    },
    initialize: function (options) {
        this._super('initialize', arguments);
        var vm = require("vm");
        this.script = vm.createScript(this.options.source);
    },
    execute: function (args, next) {
        var vm = require("vm"),
            ctx = {
                next: next,
                out: function (s) { next(null, s); }
            };
        this.script.runInNewContext(ctx);
    }
});

// ### EJSTemplate
//
// Template executed using EJS
var EJSTemplate = ks_utils.Class(BaseTemplate, {
    default_options: {
        source: ''
    },
    initialize: function (options) {
        this._super('initialize', arguments);
        this.template = require('ejs').compile(this.options.source);
    },
    execute: function (args, next) {
        var result = this.template({
            "arguments": args
        });
        next(null, result.trim());
    }
});

// ### Exported public API
module.exports = {
    BaseTemplate: BaseTemplate,
    JSTemplate: JSTemplate,
    EJSTemplate: EJSTemplate
};
