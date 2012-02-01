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

// ### Exported public API
module.exports = {
    BaseTemplate: BaseTemplate
};
