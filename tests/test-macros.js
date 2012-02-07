/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),
    
    kumascript = require('..'),
    ks_utils = kumascript.utils,
    ks_macros = kumascript.macros,
    ks_test_utils = kumascript.test_utils;

module.exports = nodeunit.testCase({

    "Basic macro substitution should work": function (test) {
        var mp = new ks_macros.MacroProcessor({ 
            loader: new ks_test_utils.JSONifyLoader()
        });
        fs.readFile(__dirname + '/fixtures/macros1.txt', function (err, data) {
            if (err) { throw err; }
            var parts = (''+data).split('---'),
                src = parts[0],
                expected = parts[1],
                ctx = {
                };
            mp.process(src, ctx, function (err, result) {
                test.equal(result.trim(), expected.trim());
                test.done();
            });
        });
    }

});
