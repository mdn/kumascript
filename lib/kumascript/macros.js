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
    ks_loaders = require(__dirname + '/loaders'),
    ks_parser = require(__dirname + '/parser');

// ### MacroProcessor class
var MacroProcessor = ks_utils.Class({

    // #### Default options
    default_options: {
        // BaseLoader is the default loader
        loader: new ks_loaders.BaseLoader()
    },

    // #### Process macros in content
    process: function (src, api_ctx, process_done) {
        var $this = this;

        var tokens = ks_parser.parse(src);

        var process_token_fn = function (tok, fe_next) {
            var next = function (val) {
                tok.out = val;
                fe_next();
            };
            if ('TEXT' == tok.type) {
                return next(tok.chars);
            }
            if ('MACRO' == tok.type) {
                // Try getting and executing the template, trapping any errors
                // along the way.
                $this.options.loader.get(tok.name, function (err, tmpl) {
                    // TODO: Need to do something more robust with errors
                    if (err) { return next('{{ ' + tok.name + ' }}'); }
                    tmpl.execute(tok.arguments, api_ctx, function (err, result) {
                        // TODO: Need to do something more robust with errors
                        if (err) { return next('{{ ' + tok.name + ' }}'); }
                        return next(result);
                    });
                });
            }
        };

        // Once all the tokens have been processed, assemble the output
        var finish_process_fn = function (err) {
            var result = _
                .map(tokens, function (t) { return t.out; })
                .join('');
            process_done(null, result);
        };

        // Finally, fire off the handlers for the macros.
        async.forEach(tokens, process_token_fn, finish_process_fn);
    },

    EOF:null
});

// ### Exported public API
module.exports = {
    MacroProcessor: MacroProcessor
};
