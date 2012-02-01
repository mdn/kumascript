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

// ### EJSTemplate
//
// Template executed using EJS
var EJSTemplate = ks_utils.Class(BaseTemplate, {
    default_options: {
        source: ''
    },
    initialize: function (options) {
        BaseTemplate.prototype.initialize.apply(this, arguments);
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
    EJSTemplate: EJSTemplate
};
