/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),
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

        // TODO: Refactor this template testing pattern into ks_test_utils.
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
                api_ctx = new ks_api.APIContext();

            api_ctx.installAPI(DemoAPI, 'demo');

            mp.process(src, api_ctx, function (err, result) {
                test.equal(result.trim(), expected.trim());
                test.done();
            });

        });
        
    },

    "Exercise some popular MDN templates that have been transliterated": function (test) {

        // TBD: Disabled for now.
        return test.done();

        // [List of popular MDN templates][tmpl_list]
        // [tmpl_list]: https://bug714804.bugzilla.mozilla.org/attachment.cgi?id=588125
        
        var $this = this,
            t_fn = 'api2.txt',
            loader = new ks_loaders.FileLoader({
                filename_template: __dirname + '/fixtures/templates/{name}.ejs'
            }),
            mp = new ks_macros.MacroProcessor({ loader: loader }),
            api_ctx = new ks_api.APIContext({ });

        api_ctx.installAPI(DemoAPI, 'demo');

        _.extend(api_ctx.wiki, {
            
            // Mock out pageExists with pretend pages.
            pageExists: function (path) {
                var pretend_exists = [
                    "en/CSS/position",
                    "en/CSS/auto",
                    "en/XUL/content",
                    "en/XUL:member",
                    "en/XPCOM_Interface_Reference/nsISupports",
                    "en/nsIDocShell"
                ];
                return (pretend_exists.indexOf(path) !== -1);
            },

            // Mock out uri() until we have a better implementation.
            uri: function (path, query) {
                var out = 'http://example.com/' + path;
                if (query) { out += '?' + query; }
                return out;
            }

        });

        api_ctx.Page.uri = api_ctx.page.uri =
            'http://example.com/en/HTML/FakePage';

        fs.readFile(__dirname + '/fixtures/' + t_fn, function (err, data) {
        
            var parts = (''+data).split('---'),
                src = parts.shift(),
                expected = parts.shift();

            mp.process(src, api_ctx, function (err, result) {
                if (err) { throw err; }
                util.debug("RESULT\n" + result.trim());
                test.equal(result.trim(), expected.trim());
                test.done();
            });

        });
        
    }

};
