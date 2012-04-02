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
    ks_server = kumascript.server,
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

// Reusable fixture-based test runner
function performTestRequest(test, expected_fn, result_url) {
    fs.readFile(expected_fn, 'utf8', function (err, expected) {
        var opts = {
            url: result_url,
            headers: { 'X-FireLogger': 'plaintext' }
        };
        request(opts, function (err, resp, result) {
            test.equal(result.trim(), expected.trim());
            test.done();
        });
    });
}

// Main test case starts here
module.exports = {

    setUp: function (next) {
        this.test_server = ks_test_utils.createTestServer();
        this.server = new ks_server.Server({
            port: 9000,
            document_url_template: "http://localhost:9001/documents/{path}.txt",
            template_url_template: "http://localhost:9001/templates/{name}.ejs",
            template_class: "EJSTemplate",
            autorequire: {
                "test_api": "autorequire-lib1"
            }
        });
        this.server.listen();
        next();
    },

    // Kill all the servers on teardown.
    tearDown: function (next) {
        this.server.close();
        this.test_server.close();
        next();
    },

    "A template can include the output of executing another template with kumascript.template()": function (test) {
        var expected_fn = __dirname + '/fixtures/documents/template-exec-expected.txt',
            result_url  = 'http://localhost:9000/docs/template-exec';
        performTestRequest(test, expected_fn, result_url);
    },

    "A template can export methods and data to another template with kumascript.require()": function (test) {
        var expected_fn = __dirname + '/fixtures/documents/library-test-expected.txt',
            result_url  = 'http://localhost:9000/docs/library-test';
        performTestRequest(test, expected_fn, result_url);
    },

    "The server can be configured to auto-require some templates": function (test) {
        var expected_fn = __dirname + '/fixtures/documents/autorequire-expected.txt',
            result_url  = 'http://localhost:9000/docs/autorequire';
        performTestRequest(test, expected_fn, result_url);
    },

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
                loader_class = ks_test_utils.LocalLoader,
                loader_options = { templates: templates },
                mp = new ks_macros.MacroProcessor({
                    loader_class: loader_class,
                    loader_options: loader_options
                }),
                api_ctx = new ks_api.APIContext();

            api_ctx.installAPI(DemoAPI, 'demo');

            mp.process(src, api_ctx, function (err, result) {
                test.equal(result.trim(), expected.trim());
                test.done();
            });

        });
        
    }

};
