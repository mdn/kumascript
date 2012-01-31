var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),
    XRegExp = require('xregexp'),
    ejs = require('ejs'),
    kumascript = require('../');

module.exports = nodeunit.testCase({

    setUp: function (next) {
        next();
    },

    tearDown: function (next) {
        next();
    },

    "Basic macro substitution should work": function (test) {
        fs.readFile(__dirname + '/data/parser1.txt', function (err, data) {
            if (err) { throw err; }
            
            var parts = (''+data).split('---'),
                src = parts[0],
                expected = parts[1],
                result = kumascript.macros.process(src, function (n,a) {
                    return JSON.stringify([n,a]);
                });
                
            test.equal(result.trim(), expected.trim());
            test.done();
        });
    }

});
