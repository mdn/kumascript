/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),
    request = require('request'),

    kumascript = require('..'),
    ks_macros = kumascript.macros,
    ks_server = kumascript.server,
    ks_test_utils = kumascript.test_utils;

module.exports = nodeunit.testCase({

    // Build both a service instance and a document server for test fixtures.
    setUp: function (next) {
        this.test_server = ks_test_utils.createTestServer();
        try {
            this.macro_processor = new ks_macros.MacroProcessor({
                macro_timeout: 500,
                loader: {
                    module: __dirname + '/../lib/kumascript/loaders',
                    class_name: 'HTTPLoader',
                    options: {
                        url_template: "http://localhost:9001/templates/{name}.ejs",
                    }
                }
            });
            this.server = new ks_server.Server({
                port: 9000,
                logging: false,
                document_url_template: "http://localhost:9001/documents/{path}.txt",
                macro_processor: this.macro_processor
            });
            this.server.listen();
        } catch (e) {
            util.debug("ERROR STARTING TEST SERVER " + e);
            throw e;
        }
        next();
    },

    // Kill all the servers on teardown.
    tearDown: function (next) {
        try {
            this.server.close();
            this.test_server.close();
        } catch (e) { /* no-op */ }
        next();
    },

    "Fetching document1 from service should be processed as expected": function (test) {
        var expected_fn = __dirname + '/fixtures/documents/document1-expected.txt',
            result_url  = 'http://localhost:9000/docs/document1';
        fs.readFile(expected_fn, 'utf8', function (err, expected) {
            request(result_url, function (err, resp, result) {
                test.equal(result.trim(), expected.trim());
                test.done();
            });
        });
    },

    "POSTing document to service should be processed as expected": function (test) {
        var expected_fn = __dirname + '/fixtures/documents/document1-expected.txt',
            source_fn   = __dirname + '/fixtures/documents/document1.txt',
            result_url  = 'http://localhost:9000/docs/';
        fs.readFile(expected_fn, 'utf8', function (err, expected) {
            fs.readFile(source_fn, 'utf8', function (err, source) {
                request.post(
                    { url: result_url, body: source },
                    function (err, resp, result) {
                        test.equal(result.trim(), expected.trim());
                        test.done();
                    }
                );
            });
        });
    },

    "Variables passed in request headers should be made available to templates": function (test) {
        var expected_fn = __dirname + '/fixtures/documents/request-variables-expected.txt',
            source_fn   = __dirname + '/fixtures/documents/request-variables.txt',
            result_url  = 'http://localhost:9000/docs/request-variables';
        fs.readFile(expected_fn, 'utf8', function (err, expected) {
            fs.readFile(source_fn, 'utf8', function (err, source) {
                var env = {
                    'locale': "en-US",
                    'alpha':  "This is the alpha value",
                    'beta':   "Consultez les forums dédiés de Mozilla",
                    'gamma':  "コミュニティ",
                    'delta':  "커뮤니티",
                    'foo':    ['one', 'two', 'three'],
                    'bar':    {'a':1, 'b':2, 'c':3}
                };
                var headers = _.chain(env).map(function (v, k) {
                    var h_key = 'x-kumascript-env-' + k,
                        d_json = JSON.stringify(v),
                        data = (new Buffer(d_json,'utf8')).toString('base64');
                    return [h_key, data];
                }).object().value();
                request.get(
                    { url: result_url, body: source, headers: headers },
                    function (err, resp, result) {
                        test.equal(result.trim(), expected.trim());
                        test.done();
                    }
                );
            });
        });
    },

    "Errors in macro processing should be included in response headers": function (test) {

        var mp = this.server.macro_processor = new ks_macros.MacroProcessor({
            macro_timeout: 500,
            loader: {
                module: __dirname + '/../lib/kumascript/test-utils',
                class_name: 'LocalClassLoader',
                options: {
                    module: __dirname + '/../lib/kumascript/test-utils',
                    templates: {
                        'broken1': null,
                        'broken2': 'BrokenCompilationTemplate',
                        'broken3': 'BrokenExecutionTemplate',
                        'MacroUsingParams': 'JSONifyTemplate',
                        'AnotherFoundMacro': 'JSONifyTemplate'
                    }
                }
            }
        });

        mp.startup(function () {
            var expected_fn = __dirname + '/fixtures/documents/document2-expected.txt',
                result_url  = 'http://localhost:9000/docs/document2';
            fs.readFile(expected_fn, 'utf8', function (err, expected) {
                var req_opts = {
                    method: "GET",
                    uri: result_url,
                    headers: {
                        "X-FireLogger": "1.2"
                    }
                };
                request(req_opts, function (err, resp, result) {

                    test.equal(result.trim(), expected.trim());

                    var expected_errors = {
                        'broken1': ["TemplateLoadingError", "NOT FOUND"],
                        'broken2': ["TemplateLoadingError", "ERROR INITIALIZING broken2"],
                        'broken3': ["TemplateExecutionError", "ERROR EXECUTING broken3"]
                    };

                    // First pass, assemble all the base64 log fragments from
                    // headers into buckets by UID.
                    var logs_pieces = {};
                    _.each(resp.headers, function (value, key) {
                        if (key.indexOf('firelogger-') !== 0) { return; }
                        var parts = key.split('-'),
                            uid = parts[1],
                            seq = parts[2];
                        if (!(uid in logs_pieces)) {
                            logs_pieces[uid] = [];
                        }
                        logs_pieces[uid][seq] = value;
                    });

                    // Second pass, decode the base64 log fragments in each bucket.
                    var logs = {};
                    _.each(logs_pieces, function (pieces, uid) {
                        var d_b64 = pieces.join(''),
                            d_json = (new Buffer(d_b64, 'base64')).toString('utf-8');
                        logs[uid] = JSON.parse(d_json).logs;
                    });

                    // Third pass, extract all kumascript error messages.
                    var errors = [];
                    _.each(logs, function (messages, uid) {
                        _.each(messages, function (m) {
                            if (m.name == 'kumascript' && m.level == 'error') {
                                errors.push(m);
                            }
                        });
                    });

                    // Finally, assert that the extracted errors match expectations.
                    _.each(errors, function (error, i) {
                        var expected = expected_errors[error.args[2].name];
                        test.equal(error.args[0], expected[0]);
                        test.ok(error.args[1].indexOf(expected[1]) !== -1);
                    });

                    test.done();

                });
            });
        });

    },

    "Error fetching source document should be logged": function (test) {
        var $this = this;

        // Induce error condition by closing down the test server.
        $this.test_server.close();
        var expected_err = 'Problem fetching source document: connect ECONNREFUSED';

        var req_opts = {
            method: "GET",
            uri: 'http://localhost:9000/docs/error-doc',
            headers: {
                "X-FireLogger": "plaintext"
            }
        };
        request.get(req_opts, function (err, resp, result) {
            // Look for the expected error message in headers
            var found_it = false;
            _.each(resp.headers, function (value, key) {
                if (key.indexOf('firelogger-') === -1) { return; }
                if (value.indexOf(expected_err) !== -1) { found_it = true; }
            });
            test.ok(found_it);
            test.done();
        });
    }

});
