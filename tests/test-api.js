/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),
    XRegExp = require('xregexp'),
    ejs = require('ejs'),

    // This also injects `Fiber` and `yield`
    fibers = require('fibers'),
    Future = require('fibers/future'),
    wait = Future.wait,
    request = require('request'),
    
    // Loading kumascript modules can use index here, because the tests aren't
    // a part of the package.
    kumascript = require('..'),
    ks_utils = kumascript.utils,
    ks_loaders = kumascript.loaders,
    ks_templates = kumascript.templates,
    ks_api = kumascript.api,
    ks_macros = kumascript.macros,
    ks_test_utils = kumascript.test_utils;

// API that includes some things useful for testing.
var DemoAPI = ks_utils.Class(ks_api.BaseAPI, {

    initialize: function (options) {
    },

    echo: function (s) {
        return s;
    },

    // snooze: demo of the fibers/future way to handle async in sync templates.
    snooze: function (ms) {
        var f = new Future(),
            s = new Date();
        setTimeout(function () {
            f['return'](); // HACK: Make jshint happy.
        }, ms);
        f.wait();
        return new Date() - s;
    },

    random: function () {
        var content = '',
            request = require('request'),
            f = new Future();
            url = 'http://www.random.org/integers/?num=1&min=1&max=1000000&'+
                  'col=1&base=10&format=plain&rnd=new';
        request(url, function (error, resp, body) {
            content = body;
            f['return'](); // HACK: Make jshint happy.
        });
        f.wait();
        return content.trim();
    }

});

// Main test case starts here
module.exports = {

    "A sub-API installed into APIContext should be usable in a template": function (test) {
        var $this = this,
            t_fn = 'api1.txt',
            t_cls = ks_templates.EJSTemplate;

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
                api_ctx = new ks_api.APIContext({
                    apis: {
                        wiki: ks_api.WikiAPI,
                        demo: DemoAPI
                    }
                });

            mp.process(src, api_ctx, function (err, result) {
                if (err) { throw err; }
                test.equal(result.trim(), expected.trim());
                test.done();
            });

        });
        
    }

}
