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

/* For dev only, generate parser from source on the fly:
 */
var PEG = require("pegjs"),
    fs = require("fs"),
    ks_parser_src = fs.readFileSync(__dirname + '/parser.pegjs', 'utf8'),
    ks_parser = PEG.buildParser(ks_parser_src);

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

        // Build up a handler to process parsed tokens.
        var process_token_fn = function (tok, fe_next) {
            // Exit point for processing, set token output and hit callback
            var next = function (val) {
                tok.out = val;
                fe_next();
            };
            if ('TEXT' == tok.type) {
                // Doing nothing, here. But, we could conceivably filter text
                // in the future.
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
        // TODO: Do this with async.queue()? forEach might be troublesome for
        // pages with 1000's of macros.
        async.forEach(tokens, process_token_fn, finish_process_fn);
    },

    EOF:null
});

// ### Exported public API
module.exports = {
    MacroProcessor: MacroProcessor
};
