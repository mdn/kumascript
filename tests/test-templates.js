/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),

    kumascript = require('..'),
    ks_templates = kumascript.templates;

// Main test case starts here
module.exports = nodeunit.testCase({
    "Embedded JS templates should work": function (test) {
        var tmpl = new ks_templates.EJSTemplate({
            source: '<%= one + two %>'
        });
        var result = tmpl.execute(
            [], {one: 1, two: 2},
            function (err, result) {
                test.equal('3', result);
                test.done();
            }
        );
    }
});
