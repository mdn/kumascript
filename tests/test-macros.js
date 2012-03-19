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
        mp.process(src, ctx, function (errors, result) {
            test.equal(result.trim(), expected.trim());
            return next(errors, result);
        });
    });
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
                test.ok(errors.length, 1, "There should be 1 error");

                var e = errors[0];
                test.equal(e.name, 'DocumentParsingError');
                test.equal(e.message, 
                    'Syntax error at line 2, column 9: Expected ' + 
                    '"\'", ")", "\\"", [ \\t\\n\\r] or [\\-.0-9] ' + 
                    'but "}" found.');
                
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
        
        var BrokenTemplateLoader = ks_utils.Class(ks_loaders.BaseLoader, {
            broken_templates: {
                'broken1': null,
                'broken2': BrokenCompilationTemplate,
                'broken3': BrokenExecutionTemplate
            },
            load: function (name, loaded_cb) {
                var cls = (name in this.broken_templates) ?
                    this.broken_templates[name] :
                    JSONifyTemplate;
                if (null === cls) {
                    loaded_cb("NOT FOUND", null);
                } else {
                    loaded_cb(null, new cls({ name: name }));
                }
            }
        });
        
        var mp = new ks_macros.MacroProcessor({
            loader_class: BrokenTemplateLoader
        });
        
        processFixture(test, mp, 'macros-broken-templates.txt',
            function (errors, result) {

                var expected_errors = [
                    [ "TemplateLoadingError",
                        "Problem loading template for macro {{ broken1 (\"this " +
                        "breaks first\") }} at offset 107: NOT FOUND" ],
                    [ "TemplateLoadingError",
                        "Problem loading template for macro {{ broken2 (\"this " +
                        "breaks second\") }} at offset 144: Error: ERROR " +
                        "INITIALIZING broken2" ],
                    [ "TemplateExecutionError",
                        "Problem executing template for macro {{ broken3 " +
                        "(\"this breaks third\") }} at offset 182: Error: ERROR " +
                        "EXECUTING broken3" ]
                ];
                
                test.ok(errors, "There should be errors");

                for (var idx=0; idx<errors.length; idx++) {
                    test.equal(errors[idx].name, expected_errors[idx][0]);
                    test.equal(errors[idx].message, expected_errors[idx][1]);
                }

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
            load: function (name, loaded_cb) {
                load_count++;
                loaded_cb(null, new CounterTemplate());
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
    }

});
