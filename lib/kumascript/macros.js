// ## KumaScript macro processing
//
// This is where the magic happens, with regards to finding, inventorying, and
// executing macros in content.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    _ = require('underscore'),
    async = require('async'),
    ks_utils = require(__dirname + '/utils'),
    ks_loaders = require(__dirname + '/loaders');

// Load the document parser, from pre-generated JS if available or on the fly
// from the grammar source.
var ks_parser;
try {
    // NOTE: For production, ensure the parser has been generated.
    // `./node_modules/.bin/pegjs lib/kumascript/parser.pegjs`
    ks_parser = require(__dirname + '/parser');
} catch (e) {
    // For dev only, generate parser from source on the fly
    var PEG = require("pegjs"),
        fs = require("fs"),
        ks_parser_fn = __dirname + '/parser.pegjs',
        ks_parser_src = fs.readFileSync(ks_parser_fn, 'utf8'),
    ks_parser = PEG.buildParser(ks_parser_src);
}

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

        // TODO: try/catch here and gracefully handle syntax errors
        var tokens = ks_parser.parse(src);

        // Build up a handler to process parsed tokens.
        var process_token_fn = function (tok, fe_next) {
            // Exit point for processing, set token output and hit callback
            var next = function (val) {
                tok.out = val;
                fe_next();
            };
            // TODO: Switch to switch() here? Maybe if we get more tokens.
            if ('TEXT' == tok.type) {
                // Doing nothing, here. But, we could conceivably filter text
                return next(tok.chars);
            }
            if ('MACRO' == tok.type) {
                // Try getting and executing the template, trapping any errors
                $this.options.loader.get(tok.name, function (err, tmpl) {
                    // TODO: Do something more robust with unfound templates
                    if (err) { return next('{{ ' + tok.name + ' }}'); }
                    tmpl.execute(tok.args, api_ctx, function (err, result) {
                        // TODO: Do something more robust with template errors
                        if (err) { return next('{{ ' + tok.name + ' }}'); }
                        return next(result);
                    });
                });
            }
        };

        // Once all the tokens have been processed, assemble the output
        var finish_process_fn = function (err) {
            var result = _.pluck(tokens, 'out').join('');
            process_done(null, result);
        };

        // Finally, fire off the handlers for the macros. This works vaguely in
        // parallel for all macros, assuming each has async code.
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
