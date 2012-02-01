// ## KumaScript utilities
//
// This module is the junk drawer. Random useful things go here.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore');

// ### Class
//
// A quick-and-dirty prototype inheritance utility with default options
// initialization.
//
// This could probably be replaced by something more capable, but it's all I
// need for right now.
// 
module.exports.Class = function (/*{superclass}, proto*/) {
    var args = Array.prototype.slice.apply(arguments),
        proto = args.pop(),
        supr = args.pop(),
        cls = function () {
            this.initialize.apply(this, arguments);
        },
        def_proto = { 
            defaults_options: { },
            initialize: function (options) {
                options = options || {};
                this.options = _.extend({}, this.default_options, options);
            } 
        };
    _.extend(cls.prototype, def_proto, (supr ? supr.prototype : {}), proto);
    return cls;
};
