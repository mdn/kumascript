/* jshint node: true, mocha: true, esversion: 6 */

var _ = require('underscore'),
    assert = require('chai').assert,
    kumascript = require('..'),
    ks_macros = kumascript.macros,
    ks_test_utils = kumascript.test_utils,
    readTestFixture = ks_test_utils.readTestFixture;

function processFixture(mp, fixture_relpath, done, next) {
    if (!next) {
        next = function (errors, result) {
            assert.isOk(!errors, "There should be no errors");
            done();
        };
    }

    readTestFixture(fixture_relpath, done, function(data) {
        var parts = data.split('---'),
            src = parts[0],
            expected = parts[1],
            ctx = {};
        if (parts.length < 2) {
            done("Please provide an expected result after '---' in " +
                 fixture_relpath);
        } else {
            mp.process(src, ctx, function (errors, result) {
                assert.equal(result.trim(), expected.trim());
                return next(errors, result);
            });
        }
    });
}

function makeErrorHandlingTestcase(fixtureName) {
    return function(done) {
        var mp = new ks_macros.MacroProcessor({
            macro_timeout: 500,
            loader: {
                module: __dirname + '/../lib/kumascript/test-utils',
                class_name: 'JSONifyLoader',
                options: {}
            }
        });
        processFixture(mp, fixtureName, done, function (errors, result) {
            assert.isOk(errors, "There should be errors");
            assert.equal(errors.length, 1, "There should be 1 error");
            var e = errors[0];
            assert.equal(e.name, 'DocumentParsingError');
            assert.notEqual(null, e.message.match(
                    /^Syntax error at line \d+, column \d+:[\s\S]*-+\^/));
            done();
        });
    };
}

describe('test-macros', function () {
    beforeEach(function (done) {
        this.mp = new ks_macros.MacroProcessor({
            macro_timeout: 500,
            loader: {
                module: __dirname + '/../lib/kumascript/test-utils',
                class_name: 'JSONifyLoader',
                options: { }
            }
        });
        this.mp.startup(done);
    });

    afterEach(function (done) {
        this.mp.shutdown(done);
    });

    it('Basic macro substitution should work', function (done) {
        processFixture(this.mp, 'macros1.txt', done);
    });

    it('Errors in document parsing should be handled gracefully and reported', function (done) {
        processFixture(this.mp, 'macros-document-syntax-error.txt', done,
            function (errors, result) {
                assert.isOk(errors, "There should be errors");
                assert.equal(errors.length, 1, "There should be 1 error");

                var e = errors[0];
                assert.equal(e.name, 'DocumentParsingError');
                assert.equal(0, e.message.indexOf('Syntax error at line'));

                // Note: This is a *bit* brittle, but it makes sure the error
                // indicator appears at the expected spot in the context lines
                // included in the message.
                assert.equal(
                    265, e.message.indexOf('-----------------------------^'));
                done();
            });
    });

    it('A numeric macro argument with a decimal point should not be trimmed to an integer', function (done) {
        processFixture(this.mp, 'macros-decimal-argument.txt', done);
    });

    it('Escaped single and double quotes should work in any quoting context', function (done) {
        processFixture(this.mp, 'macros-document-escaped-quotes.txt', done);
    });

    it('Empty parameters should be accepted', function (done) {
        processFixture(this.mp, 'macros-document-empty-parameter.txt', done);
    });

    it('Double right brace in a document should not result in a syntax error', function (done) {
        processFixture(this.mp, 'macros-document-double-brace.txt', done);
    });

    it('Errors in template loading, compilation, and execution should be handled gracefully and reported', function (done) {

        var mp = new ks_macros.MacroProcessor({
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
            var events = [],
                ev_names = ['start', 'error', 'end',
                            'autorequireStart', 'autorequireEnd',
                            'templateLoadStart', 'templateLoadEnd',
                            'macroStart', 'macroEnd'];
            _(ev_names).each(function (name, idx) {
                mp.on(name, function (m) {
                    events.push([name, (m && 'name' in m) ? m.name : null]);
                });
            });

            processFixture(mp, 'macros-broken-templates.txt', done,
                function (errors, result) {
                    var expected_errors = {
                        'broken1': ["TemplateLoadingError", "NOT FOUND"],
                        'broken2': ["TemplateLoadingError", "ERROR INITIALIZING broken2"],
                        'broken3': ["TemplateExecutionError", "ERROR EXECUTING broken3"]
                    };

                    assert.isOk(errors, "There should be errors");

                    for (var idx=0; idx<errors.length; idx++) {
                        var error = errors[idx];
                        var expected = expected_errors[error.options.name];
                        assert.equal(error.name, expected[0]);
                        assert.isOk((''+error.message).indexOf(expected[1]) !== -1);
                        if ('broken3' == error.options.name) {
                            // Note: This is a *bit* brittle, but it makes sure the error
                            // indicator appears at the expected spot in the context lines
                            // included in the message.
                            assert.equal(264, error.message.indexOf('---------------------^'));
                        }
                    }

                    mp.shutdown(done);
                }
            );
        });
    });

    it('Check for unrecoverable errors during initialize', function (done) {
        assert.doesNotThrow(
            function() {
                // This should not throw an error.
                new ks_macros.MacroProcessor({
                    loader: {
                        module: __dirname + '/../lib/kumascript/loaders',
                        class_name: 'FileLoader',
                        options: {
                            root_dir: 'tests/fixtures/templates',
                        }
                    }
                });
            }
        );
        assert.throws(
            function() {
                // This should throw a "duplicate macros" error.
                new ks_macros.MacroProcessor({
                    loader: {
                        module: __dirname + '/../lib/kumascript/loaders',
                        class_name: 'FileLoader',
                        options: {
                            root_dir: 'tests/fixtures',
                        }
                    }
                });
            }
        );
        done();
    });

    it('Errors in ArgumentsJSON should be reported with line and column numbers',
        makeErrorHandlingTestcase('macros-syntax-error-argumentsjson.txt')
    );

    it('Errors in ArgumentList should be reported with line and column numbers',
        makeErrorHandlingTestcase('macros-syntax-error-argumentlist.txt')
    );
});
