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
// TODO: Instead use this? <http://ejohn.org/blog/simple-javascript-inheritance/>
module.exports.Class = function (/*{superclass}, proto*/) {

    // Dirty trick, processing arguments in reverse to catch the optional
    var args = Array.prototype.slice.apply(arguments),
        proto = args.pop(),
        supr = args.pop(),
        supr_proto = (supr ? supr.prototype : {});

    // Create the universal constructor.
    var cls = function (options) {
        options = options || {};
        this.options = _.extend({}, this.default_options, options);
        this.initialize.apply(this, arguments);
    };

    // Build the default prototype.
    var def_proto = {
        defaults_options: { },
        initialize: function (options) { }
    };

    // Inheritance magic, here. Overlay the default, superclass, current class,
    // and imposed prototype onto the just-created universal constructor.
    _.extend(cls.prototype, def_proto, supr_proto, proto);

    return cls;
};
