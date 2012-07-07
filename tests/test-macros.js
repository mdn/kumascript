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
            ctx = new ks_api.APIContext({ });
        if (parts.length < 2) {
            throw "Please provide an expected result after '---' in " +
                fixture_path;
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
            loader_class: ks_test_utils.JSONifyLoader
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

    "Basic macro substitution should work": function (test) {
        var mp = new ks_macros.MacroProcessor({ 
            loader_class: ks_test_utils.JSONifyLoader
        });
        processFixture(test, mp, 'macros1.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Errors in document parsing should be handled gracefully and reported": function (test) {
        var mp = new ks_macros.MacroProcessor({
            loader_class: ks_test_utils.JSONifyLoader
        });
        processFixture(test, mp, 'macros-document-syntax-error.txt',
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

    "Escaped single and double quotes should work in any quoting context": function (test) {
        var mp = new ks_macros.MacroProcessor({
            loader_class: ks_test_utils.JSONifyLoader
        });
        processFixture(test, mp, 'macros-document-escaped-quotes.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Empty parameters should be accepted": function (test) {
        var mp = new ks_macros.MacroProcessor({
            loader_class: ks_test_utils.JSONifyLoader
        });
        processFixture(test, mp, 'macros-document-empty-parameter.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Double right brace in a document should not result in a syntax error": function (test) {
        var mp = new ks_macros.MacroProcessor({ 
            loader_class: ks_test_utils.JSONifyLoader
        });
        processFixture(test, mp, 'macros-document-double-brace.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
            });
    },

    "Errors in template loading, compilation, and execution should be handled gracefully and reported": function (test) {

        var JSONifyTemplate = ks_test_utils.JSONifyTemplate;

        var BrokenCompilationTemplate = ks_utils.Class(ks_templates.BaseTemplate, {
            initialize: function (options) {
                throw new Error("ERROR INITIALIZING " + this.options.name);
            }
        });
        
        var BrokenExecutionTemplate = ks_utils.Class(ks_templates.BaseTemplate, {
            execute: function (args, ctx, next) {
                throw new Error("ERROR EXECUTING " + this.options.name);
            }
        });
        
        var LocalClassLoader = ks_utils.Class(ks_loaders.BaseLoader, {
            load: function (name, cb) {
                if (!this.options.templates[name]) {
                    cb('NOT FOUND', null);
                } else {
                    cb(null, name);
                }
            },
            compile: function (name, cb) {
                var cls = (name in this.options.templates) ?
                    this.options.templates[name] :
                    JSONifyTemplate;
                try {
                    cb(null, new cls({ name: name }));
                } catch (e) {
                    cb(e, null);
                }
            }
        });
        
        var mp = new ks_macros.MacroProcessor({
            loader_class: LocalClassLoader,
            loader_options: {
                templates: {
                    'broken1': null,
                    'broken2': BrokenCompilationTemplate,
                    'broken3': BrokenExecutionTemplate,
                    'MacroUsingParams': JSONifyTemplate,
                    'AnotherFoundMacro': JSONifyTemplate
                }
            }
        });

        processFixture(test, mp, 'macros-broken-templates.txt',
            function (errors, result) {
                var expected_errors = [
                    [ "TemplateLoadingError", "NOT FOUND" ],
                    [ "TemplateLoadingError", "ERROR INITIALIZING broken2" ],
                    [ "TemplateExecutionError", "ERROR EXECUTING broken3" ]
                ];
                
                test.ok(errors, "There should be errors");

                for (var idx=0; idx<errors.length; idx++) {
                    test.equal(errors[idx].name, expected_errors[idx][0]);
                    test.ok(errors[idx].message.indexOf(expected_errors[idx][1]) !== -1);
                }

                // Note: This is a *bit* brittle, but it makes sure the error
                // indicator appears at the expected spot in the context lines
                // included in the message.
                test.equal(295, errors[2].message.indexOf('---------------------^'));

                test.done();
            }
        );

    },

    "Templates for macros should only be loaded once, executed once per unique argument set": function (test) {
        var load_count = 0,
            exec_count = 0;
        var CounterTemplate = ks_utils.Class(ks_templates.BaseTemplate, {
            execute: function (args, ctx, next) {
                exec_count++;
                next(null, args[0] + '=' + exec_count + '/' + load_count);
            }
        });
        var CounterTemplateLoader = ks_utils.Class(ks_loaders.BaseLoader, {
            load: function (name, cb) {
                load_count++;
                cb(null, new CounterTemplate());
            },
            compile: function (obj, cb) {
                cb(null, obj);
            }
        });
        var mp = new ks_macros.MacroProcessor({
            loader_class: CounterTemplateLoader
        });
        processFixture(test, mp, 'macros-repeated-macros.txt',
            function (errors, result) {
                test.equal(3, exec_count);
                test.equal(1, load_count);
                test.done();
            }
        );
    },

    "Documents with no macros should not cause the server to hang": function (test) {
        var done = false;
        var mp = new ks_macros.MacroProcessor({ 
            loader_class: ks_test_utils.JSONifyLoader
        });
        setTimeout(function () {
            if (done) { return; }
            test.ok(false, 'Test timed out, assuming a hang.');
            test.done();
        }, 250);
        processFixture(test, mp, 'macros-no-macros.txt',
            function (errors, result) {
                test.ok(!errors, "There should be no errors");
                test.done();
                done = true;
            }
        );
    },

    "Errors in ArgumentsJSON should be reported with line and column numbers":
        makeErrorHandlingTestcase('macros-syntax-error-argumentsjson.txt'),

    "Errors in ArgumentList should be reported with line and column numbers":
        makeErrorHandlingTestcase('macros-syntax-error-argumentlist.txt'),
});
