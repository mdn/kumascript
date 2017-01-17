/*jshint node: true, expr: false, boss: true */

var fs = require('fs'),
    async = require('async'),
    nodeunit = require('nodeunit'),

    morgan = require('morgan'),
    express = require('express'),

    kumascript = require('..'),
    ks_loaders = kumascript.loaders,
    ks_test_utils = kumascript.test_utils;

var DEBUG = false;

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

    "The FileLoader should detect duplicates": function (test) {
        test.throws(
            function() {
                new ks_loaders.FileLoader({
                    root_dir: 'tests/fixtures'
                });
            }
        );
        test.done();
    },

    "Template loading via FileLoader": function (test) {
        var loader = new ks_loaders.FileLoader({
            root_dir: 'tests/fixtures/templates'
        });
        var tmpl_fn = __dirname + '/fixtures/templates/t1.ejs';
        fs.readFile(tmpl_fn, function (err, expected) {
            loader.get('t1', function (err, tmpl) {
                test.ifError(err);
                if (!err) {
                    test.equal(expected, tmpl.options.source);
                }
                test.done();
            });
        });
    },

    "Template loading (with colons in name) via FileLoader": function (test) {
        var loader = new ks_loaders.FileLoader({
            root_dir: 'tests/fixtures/templates'
        });
        var tmpl_fn = __dirname +
                      '/fixtures/templates/template-exec-template.ejs';
        fs.readFile(tmpl_fn, function (err, expected) {
            loader.get('TemPlaTe:eXec:teMplatE', function (err, tmpl) {
                test.ifError(err);
                if (!err) {
                    test.equal(expected, tmpl.options.source);
                }
                test.done();
            });
        });
    },

    "Template loading via HTTP should work": function (test) {
        var test_server = ks_test_utils.createTestServer();
        var loader = new ks_loaders.HTTPLoader({
            url_template: 'http://localhost:9001/templates/{name}.ejs'
        });
        var tmpl_fn = __dirname + '/fixtures/templates/t1.ejs';
        fs.readFile(tmpl_fn, function (err, expected) {
            loader.get('t1', function (err, tmpl) {
                test.equal(expected, tmpl.options.source);
                test_server.close();
                test.done();
            });
        });
    },

    "Template loading via HTTP should retry on failure": function (test) {
        var responses = [
            { status: 500, body: 'INTERNAL SERVER ERROR' },
            { status: 503, body: 'SERVICE UNAVAILABLE' },
            { status: 204, body: 'NO CONTENT' },
            { status: 200, body: '' },
            { status: 200, body: 'OK' }
        ];

        var app = express();
        if (DEBUG) {
            app.use(morgan('TEST: :method :url :status :res[content-length]'));
        }
        app.use(function (req, res, mw_next) {
            setTimeout(mw_next, 50);
        });

        var request_ct = 0;
        app.get('/templates/*', function (req, res) {
            var response = responses[request_ct++];
            if (!response) {
                res.status(405).send('Ran out of responses');
            } else {
                res.status(response.status).send(response.body);
            }
        });
        var server = app.listen(9001);

        var loader = new ks_loaders.HTTPLoader({
            url_template: 'http://localhost:9001/templates/{name}',
            cache_control: 'max-age=0',
            max_retries: responses.length - 1
        });

        loader.get('testit', function (err, tmpl) {
            test.ok(!!tmpl);
            test.equal(responses[responses.length-1].body,
                       tmpl.options.source);
            server.close();
            test.done();
        });
    },

    "Template loading via HTTP should use conditional GET": function (test) {

        var responses = [
            { body: "EXPECTED #1",
              lastmod: "Thu, 17 May 2012 18:13:54 GMT",
              status_expected: 200 },
            { body: "EXPECTED #1",
              lastmod: "Thu, 17 May 2012 18:13:54 GMT" ,
              status_expected: 304 },
            { body: "EXPECTED #2",
              lastmod: "Thu, 17 May 2012 19:24:32 GMT",
              status_expected: 200 },
            { body: "EXPECTED #2",
              lastmod: "Thu, 17 May 2012 19:24:32 GMT",
              status_expected: 304 },
        ];

        var app = express();
        if (DEBUG) {
            app.use(morgan('TEST: :method :url :status :res[content-length]'));
        }
        app.use(function (req, res, mw_next) {
            setTimeout(mw_next, 50);
        });

        var request_ct = 0;
        app.get('/templates/*', function (req, res) {
            var response = responses[request_ct++];
            if (!response) {
                res.status(405).send('Ran out of responses');
            } else {
                var status = 200;

                // Check if any conditional GET headers match
                var ims = req.get('if-modified-since');
                if (ims == response.lastmod) { status = 304; }

                // Assert the expected conditional GET response condition.
                test.equals(status, response.status_expected);

                res.set('Last-Modified', response.lastmod);
                res.status(status).send((304 == status) ? '' : response.body);
            }
        });
        var server = app.listen(9001);

        var loader = new ks_loaders.HTTPLoader({
            url_template: 'http://localhost:9001/templates/{name}',
            cache_control: 'max-age=0'
        });

        async.waterfall([
            function (next) {
                loader.get('testit', function (err, tmpl) {
                    test.equal(responses[0].body, tmpl.options.source);
                    next();
                });
            },
            function (next) {
                loader.get('testit', function (err, tmpl) {
                    test.equal(responses[1].body, tmpl.options.source);
                    next();
                });
            },
            function (next) {
                loader.get('testit', function (err, tmpl) {
                    test.equal(responses[2].body, tmpl.options.source);
                    next();
                });
            },
            function (next) {
                loader.get('testit', function (err, tmpl) {
                    test.equal(responses[3].body, tmpl.options.source);
                    next();
                });
            }
        ], function (err) {
            server.close();
            test.done();
        });

    }

});
