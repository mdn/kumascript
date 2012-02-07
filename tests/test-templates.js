/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),

    kumascript = require('..'),
    ks_utils = kumascript.utils,
    ks_templates = kumascript.templates,
    ks_api = kumascript.api,
    ks_macros = kumascript.macros,
    ks_test_utils = kumascript.test_utils;

// Main test case starts here
module.exports = nodeunit.testCase({

    "Embedded JS templates should work": function (test) {
        testTemplateClass(test, ks_templates.EJSTemplate, 'templates1.txt');
    },

    "JS sandboxed by node.js should work": function (test) {
        testTemplateClass(test, ks_templates.JSTemplate, 'templates2.txt');
    }

    // TODO: Template loading from filesystem
    // TODO: Template loading via HTTP (preload, async, before processing?)
});

function testTemplateClass(test, t_cls, t_fn) {

    fs.readFile(__dirname + '/fixtures/' + t_fn, function (err, data) {
        if (err) { throw err; }

        var parts = (''+data).split('---'),
            src = parts.shift(),
            expected = parts.shift(),
            templates = {
                t1: new t_cls({source: parts.shift()}),
                t2: new t_cls({source: parts.shift()}),
                t3: new t_cls({source: parts.shift()})
            },
            loader = new ks_test_utils.LocalLoader({ templates: templates }),
            mp = new ks_macros.MacroProcessor({ loader: loader }),
            api_ctx = {};

        mp.process(src, api_ctx, function (err, result) {
            if (err) { throw err; }
            test.equal(result.trim(), expected.trim());
            test.done();
        });

    });

}
