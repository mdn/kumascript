/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),

    kumascript = require('..'),
    ks_utils = kumascript.utils,
    ks_loaders = kumascript.loaders,
    ks_test_utils = kumascript.test_utils;

module.exports = nodeunit.testCase({

    "Basic template loading should work": function (test) {
        
        var loader = new ks_test_utils.JSONifyLoader(),
            data = ["test123", ["alpha", "beta", "gamma"]],
            expected = JSON.stringify(data);

        loader.get(data[0], function (err, tmpl) {
            
            test.ok(!err);
            test.notEqual(typeof(tmpl), 'undefined');
        
            tmpl.execute(data[1], {}, function (err, result) {
                test.equal(result, expected);
                test.done();
            });

        });

    },

    "Template loading with local caching should work": function (test) {
        
        var loader = new ks_test_utils.JSONifyLoader(),
            data = ["test123", ["alpha", "beta", "gamma"]],
            expected = JSON.stringify(data);

        // Install the caching mixin into the loader.
        _.extend(loader, ks_loaders.LocalCacheMixin);

        loader.get(data[0], function (err, tmpl) {
            
            test.ok(!err);
            test.notEqual(typeof(tmpl), 'undefined');
        
            tmpl.execute(data[1], {}, function (err, result) {
                test.equal(result, expected);

                // Ensure the cache is present, and populated
                test.notEqual(typeof(loader.cache), 'undefined');
                test.ok(data[0] in loader.cache);
                
                test.done();
            });

        });
    }

    // TODO: Template loading from filesystem
    // TODO: Template loading via HTTP (preload, async, before processing?)
});
