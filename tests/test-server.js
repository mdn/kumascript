/* jshint node: true, mocha: true, esversion: 6 */

var sinon = require('sinon'),
    _ = require('underscore'),
    assert = require('chai').assert,
    kumascript = require('..'),
    ks_macros = kumascript.macros,
    ks_server = kumascript.server,
    ks_test_utils = kumascript.test_utils,
    testRequest = ks_test_utils.testRequest,
    readTestFixture = ks_test_utils.readTestFixture,
    testRequestExpected = ks_test_utils.testRequestExpected;

function getURL(uri) {
    return 'http://localhost:9000' + uri;
}

describe('test-server', function () {
    beforeEach(function() {
        // Build both a kumascript instance and a document server for tests.
        this.test_server = ks_test_utils.createTestServer();
        this.test_server.get('/readiness/?', function (req, res) {
            res.sendStatus(204);
        });
        this.macro_processor = new ks_macros.MacroProcessor({
            macro_timeout: 500,
            loader: {
                module: __dirname + '/../lib/kumascript/loaders',
                class_name: 'FileLoader',
                options: {
                    root_dir: "tests/fixtures/templates",
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
    });

    afterEach(function () {
        // Kill all the servers on teardown.
        this.server.close();
        this.test_server.close();
    });

    it('Fetching the root returns the homepage', function (done) {
        testRequestExpected(
            getURL('/'),
            'homepage-expected.html',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    it('Fetching document1 from service should be processed as expected', function (done) {
        testRequestExpected(
            getURL('/docs/document1'),
            'documents/document1-expected.txt',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    it('Fetching 시작하기 from service should be processed as expected', function (done) {
        testRequestExpected(
            getURL('/docs/' + encodeURI('시작하기')),
            'documents/시작하기-expected.txt',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    it('POSTing document to service should be processed as expected', function (done) {
        var source_filename = 'documents/document1.txt';
        readTestFixture(source_filename, done, function(source) {
            testRequestExpected(
                { method: 'POST', url: getURL('/docs/'), body: source },
                'documents/document1-expected.txt',
                done,
                function(resp, result, expected) {
                    assert.equal(result.trim(), expected.trim());
                }
            );
        });
    });

    it('Variables passed in request headers should be made available to templates', function (done) {
        function makeHeader(value, key) {
            var h_key = 'x-kumascript-env-' + key,
                d_json = JSON.stringify(value),
                data = (new Buffer(d_json, 'utf8')).toString('base64');
            return [h_key, data];
        }

        var env = {
                'locale': "en-US",
                'alpha':  "This is the alpha value",
                'beta':   "Consultez les forums dédiés de Mozilla",
                'gamma':  "コミュニティ",
                'delta':  "커뮤니티",
                'foo':    ['one', 'two', 'three'],
                'bar':    {'a':1, 'b':2, 'c':3}
            },
            headers = _.chain(env).map(makeHeader).object().value(),
            source_filename = 'documents/request-variables.txt';

        readTestFixture(source_filename, done, function(source) {
            testRequestExpected(
                { method: 'GET',
                  url: getURL('/docs/request-variables'),
                  body: source,
                  headers: headers
                },
                'documents/request-variables-expected.txt',
                done,
                function(resp, result, expected) {
                    assert.equal(result.trim(), expected.trim());
                }
            );
        });
    });

    it('Errors in macro processing should be included in response headers', function (done) {

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

        function extractErrors(resp) {
            // First pass, assemble all the base64 log fragments
            // from headers into buckets by UID.
            var logs_pieces = {};
            _.each(resp.headers, function (value, key) {
                if (key.indexOf('firelogger-') !== 0) {
                    return;
                }
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
            var errors = {};
            _.each(logs, function (messages, uid) {
                _.each(messages, function (m) {
                    if (m.name == 'kumascript' && m.level == 'error') {
                        errors[m.args[2].name] = m.args.slice(0, 2);
                    }
                });
            });

            return errors;
        }

        mp.startup(function () {
            var req_opts = {
                    method: "GET",
                    uri: getURL('/docs/document2'),
                    headers: {
                        "X-FireLogger": "1.2"
                    }
                },
                expected_errors = {
                    'broken1': ["TemplateLoadingError",
                                "NOT FOUND"],
                    'broken2': ["TemplateLoadingError",
                                "ERROR INITIALIZING broken2"],
                    'broken3': ["TemplateExecutionError",
                                "ERROR EXECUTING broken3"]
                },
                expected_filename = 'documents/document2-expected.txt';

            testRequestExpected(req_opts, expected_filename, done,
                function(resp, result, expected) {
                    assert.equal(result.trim(), expected.trim());
                    assert.equal(resp.headers.vary, 'X-FireLogger');

                    var errors = extractErrors(resp);

                    // Ensure that we saw the same expected errors.
                    assert.sameMembers(_.keys(errors),
                                       _.keys(expected_errors));
                    // Check the error values against what is expected.
                    _.each(expected_errors, function (expected, name) {
                        var error = errors[name];
                        assert.equal(error[0], expected[0]);
                        assert.isTrue(error[1].indexOf(expected[1]) !== -1);
                    });
                }
            );
        });
    });

    it('Error fetching source document should be logged', function (done) {
        // Induce error condition by closing down the test server.
        this.test_server.close();

        var expected_err =
                'Problem fetching source document: connect ECONNREFUSED',
            req_opts = {
                method: "GET",
                uri: getURL('/docs/error-doc'),
                headers: {
                    "X-FireLogger": "plaintext"
                }
            };

        testRequest(req_opts, done, function (resp, result) {
            // Look for the expected error message in the headers.
            var found_it = false;
            _.each(resp.headers, function (value, key) {
                if (key.indexOf('firelogger-') === -1) {
                    return;
                }
                if (value.indexOf(expected_err) !== -1) {
                    found_it = true;
                }
            });
            assert.isTrue(found_it);
        });
    });

    it('Fetching /macros returns macro details', function (done) {
        testRequestExpected(getURL('/macros'), 'macros-expected.json', done,
            function(resp, result, expected) {
                assert.deepEqual(JSON.parse(result), JSON.parse(expected));
            }
        );
    });

    it('Liveness endpoint returns 204 when live', function (done) {
        testRequest(getURL('/healthz'), done, function (resp, result) {
            assert.equal(resp.statusCode, 204);
        });
    });

    it('Readiness endpoint returns 204 when ready', function (done) {
        testRequest(getURL('/readiness'), done, function (resp, result) {
            assert.equal(resp.statusCode, 204);
        });
    });

    it('Readiness endpoint returns 503 when macro loader failure', function (done) {
        this.macro_processor.makeLoader = sinon.stub();
        this.macro_processor.makeLoader.throws('duplicate macros');
        testRequest(getURL('/readiness'), done, function (resp, result) {
            assert.equal(resp.statusCode, 503);
            assert.notEqual(result.indexOf('(macro loader error)'), -1);
            assert.notEqual(result.indexOf('(duplicate macros)'), -1);
        });
    });

    it('Readiness endpoint returns 503 when doc service failure', function (done) {
        this.test_server.close();
        testRequest(getURL('/readiness'), done, function (resp, result) {
            assert.equal(resp.statusCode, 503);
            assert.notEqual(
                result.indexOf('(document service is not ready)'),
                -1
            );
        });
    });

    it('Readiness endpoint returns 503 when doc service not ready', function (done) {
        this.test_server.close();
        this.test_server = ks_test_utils.createTestServer();
        this.test_server.get('/readiness/?', function (req, res) {
            res.status(503).send('service unavailable due to database issue');
        });
        testRequest(getURL('/readiness'), done, function (resp, result) {
            assert.equal(resp.statusCode, 503);
            assert.notEqual(
                result.indexOf('(document service is not ready)'),
                -1
            );
            assert.notEqual(
                result.indexOf('(service unavailable due to database issue)'),
                -1
            );
        });
    });
});
