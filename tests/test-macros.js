/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    _ = require('underscore'),
    nodeunit = require('nodeunit'),
    
    kumascript = require('..'),
    ks_utils = kumascript.utils,
    ks_macros = kumascript.macros,
    ks_templates = kumascript.templates,
    ks_loaders = kumascript.loaders,
    ks_api = kumascript.api,
    ks_test_utils = kumascript.test_utils;

function processFixture(test, mp, fixture_path, next) {
    fs.readFile(__dirname + '/fixtures/' + fixture_path, function (err, data) {
        if (err) { throw err; }
        var parts = (''+data).split('---'),
            src = parts[0],
            expected = parts[1],
            ctx = {};
        if (parts.length < 2) {
            throw "Please provide an expected result after '---' in " + fixture_path;
        }
        mp.process(src, ctx, function (errors, result) {
            test.equal(result.trim(), expected.trim());
            return next(errors, result);
        });
    });
}

function makeErrorHandlingTestcase(fixtureName) {
    return function(test) {
        var mp = new ks_macros.MacroProcessor({
            macro_timeout: 500,
            loader: {
                module: __dirname + '/../lib/kumascript/test-utils',
                class_name: 'JSONifyLoader',
                options: { }
            }
        });
        processFixture(test, mp, fixtureName,
            function (errors, result) {

                test.ok(errors, "There should be errors");
                test.equal(errors.length, 1, "There should be 1 error");

                var e = errors[0];
                test.equal(e.name, 'DocumentParsingError');
                test.notEqual(null, e.message.match(
                        /^Syntax error at line \d+, column \d+:[\s\S]*-+\^/));
                test.done();
            });
    };
}

module.exports = nodeunit.testCase({

    setUp: function (next) {
        this.mp = new ks_macros.MacroProcessor({ 
            macro_timeout: 500,
            loader: {
                module: __dirname + '/../lib/kumascript/test-utils',
                class_name: 'JSONifyLoader',
                options: { }
            }
        });
        this.mp.startup(next);
    },

    tearDown: function (next) {
        this.mp.shutdown(next);
    },

    "Basic macro substitution should work": function (test) {
        processFixture(test, this.mp, 'macros1.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Errors in document parsing should be handled gracefully and reported": function (test) {
        processFixture(test, this.mp, 'macros-document-syntax-error.txt',
            function (errors, result) {
                test.ok(errors, "There should be errors");
                test.equal(errors.length, 1, "There should be 1 error");

                var e = errors[0];
                test.equal(e.name, 'DocumentParsingError');
                test.equal(0, e.message.indexOf('Syntax error at line'));

                // Note: This is a *bit* brittle, but it makes sure the error
                // indicator appears at the expected spot in the context lines
                // included in the message.
                test.equal(265, e.message.indexOf('-----------------------------^'));
                test.done();
            });
    },

    "A numeric macro argument with a decimal point should not be trimmed to an integer": function (test) {
        processFixture(test, this.mp, 'macros-decimal-argument.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Escaped single and double quotes should work in any quoting context": function (test) {
        processFixture(test, this.mp, 'macros-document-escaped-quotes.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Empty parameters should be accepted": function (test) {
        processFixture(test, this.mp, 'macros-document-empty-parameter.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Double right brace in a document should not result in a syntax error": function (test) {
        processFixture(test, this.mp, 'macros-document-double-brace.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Errors in template loading, compilation, and execution should be handled gracefully and reported": function (test) {

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
            var events = [];
            var ev_names = ['start', 'error', 'end',
                            'autorequireStart', 'autorequireEnd',
                            'templateLoadStart', 'templateLoadEnd',
                            'macroStart', 'macroEnd'];
            _(ev_names).each(function (name, idx) {
                mp.on(name, function (m) {
                    events.push([name, (m && 'name' in m) ? m.name : null]);
                });
            });

            processFixture(test, mp, 'macros-broken-templates.txt',
                function (errors, result) {
                    var expected_errors = {
                        'broken1': ["TemplateLoadingError", "NOT FOUND"],
                        'broken2': ["TemplateLoadingError", "ERROR INITIALIZING broken2"],
                        'broken3': ["TemplateExecutionError", "ERROR EXECUTING broken3"]
                    };
                    
                    test.ok(errors, "There should be errors");

                    for (var idx=0; idx<errors.length; idx++) {
                        var error = errors[idx];
                        var expected = expected_errors[error.options.name];
                        test.equal(error.name, expected[0]);
                        test.ok((''+error.message).indexOf(expected[1]) !== -1);
                        if ('broken3' == error.options.name) {
                            // Note: This is a *bit* brittle, but it makes sure the error
                            // indicator appears at the expected spot in the context lines
                            // included in the message.
                            test.equal(264, error.message.indexOf('---------------------^'));
                        }
                    }

                    mp.shutdown(function () {
                        test.done();
                    });
                }
            );
        });
    },

    "Errors in ArgumentsJSON should be reported with line and column numbers":
        makeErrorHandlingTestcase('macros-syntax-error-argumentsjson.txt'),

    "Errors in ArgumentList should be reported with line and column numbers":
        makeErrorHandlingTestcase('macros-syntax-error-argumentlist.txt')
});
