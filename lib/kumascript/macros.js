// ## KumaScript macro processing
//
// This is where the magic happens, with regards to finding, inventorying, and
// executing macros in content.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),
    async = require('async'),
    XRegExp = require('xregexp'),
    ks_utils = require(__dirname + '/utils'),
    ks_loaders = require(__dirname + '/loaders');

// ### Private constants
var 
    // Macros look `{{ SomethingLike('this', 'example') }}`
    MACRO_RE = /\{\{([^\}]+)\}\}/gi,
    // Parts of a macro are `SomethingLike` and `('this', 'example')`
    PARTS_RE = /([^\(]+)(\([^\)]+\))?/,
    // The arguments list is contained in parentheses with flexible whitespace
    ARGS_RE  = /\s*\(\s*(.*)\s*\)\s*/;

// ### MacroProcessor class
var MacroProcessor = ks_utils.Class({

    // #### Default options
    default_options: {
        // BaseLoader is the default loader
        loader: new ks_loaders.BaseLoader()
    },

    // #### Process macros in content
    process: function (src, process_done) {
        var $this = this,
            macros = [],
            macro_results = {};

        // Scan for and parse macros in the content.
        XRegExp.iterate(src, MACRO_RE, function (match) {
            var m_parts = PARTS_RE.exec(match[1].trim()),
                m_args  = ARGS_RE.exec(m_parts[2] || '()'),
                args    = CSVtoArray(m_args[1]);
            macros.push([
                (''+match[0]).trim(),
                (''+m_parts[1]).trim(),
                args
            ]);
        });

        // Prepare a handler to execute a parsed template asynchronously.
        var macro_exec_fn = function (m, fe_next) {
            var macro = m[0], name = m[1], args = m[2];
            $this.options.loader.get(name, function (err, tmpl_fn) {
                tmpl_fn(args, function (err, result) {
                    macro_results[macro] = result;
                    fe_next();
                });
            });
        };

        // Prepare a handler to replace macros in content with their results.
        var finish_process_fn = function (err) {
            process_done(null, src.replace(MACRO_RE, function (s) {
                return (s in macro_results) ? macro_results[s] : s;
            }));
        };

        // Finally, execute the templates and then finish up the macro
        // replacement.
        async.forEach(macros, macro_exec_fn, finish_process_fn);
    },

    EOF:null
});

// ### Parse a line of CSV into an array
// 
// Pretending the arguments list for a macro is actually just line of
// comma-separated values is handy.
//
// See also: <http://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript>
//
function CSVtoArray (text) {
    var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    // Return NULL if input string is not well formed CSV string.
    if (!re_valid.test(text)) return null;
    // Initialize array to receive values.
    var a = [];                     
    // "Walk" the string using replace with callback.
    text.replace(re_value,
        function(m0, m1, m2, m3) {
            // Remove backslash from \' in single quoted values.
            if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
            // Remove backslash from \" in double quoted values.
            else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
            else if (m3 !== undefined) a.push(m3);
            return ''; // Return empty string.
        });
    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) a.push('');
    return a;
}

// ### Exported public API
module.exports = {
    MacroProcessor: MacroProcessor
};
