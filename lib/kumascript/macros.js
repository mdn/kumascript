// ## KumaScript macro processing
//
// This is where the magic happens, with regards to finding, inventorying, and
// executing macros in content.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    crypto = require('crypto'),
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
        loader_class: ks_loaders.BaseLoader,
        loader_options: {},
        // Template execution queue concurrency
        queue_concurrency: 16
    },

    // #### Process macros in content
    process: function (src, api_ctx, process_done) {
        var $this = this,
            errors = [],
            macros = {};

        var loader_options = $this.options.loader_options,
            loader = new $this.options.loader_class(loader_options);

        // Attempt to parse the document, trap errors
        var tokens = [];
        try { tokens = ks_parser.parse(src); }
        catch (e) {
            errors.push(new DocumentParsingError({ error: e }));
            return process_done(errors, src);
        }

        // Handler to evaluate a unique macro by its hash.
        var process_macro_fn = function (hash, q_next) {

            var tok = macros[hash];
            var next = function (out) {
                tok.out = out;
                q_next();
            };

            // Try loading the template named by the macro...
            loader.get(tok.name, function (err, tmpl) {
        
                if (err) {
                    // There was an error loading the template. :(
                    errors.push(new TemplateLoadingError({
                        token: tok, error: err
                    }));
                    // TODO: Is this the right thing to do on error?
                    return next('{{ ' + tok.name + ' }}');
                }
                
                try {
                
                    // Try executing the template with macro arguments
                    api_ctx.setArguments(tok.args);
                    tmpl.execute(tok.args, api_ctx, function (err, result) {
                        if (err) { 
                            // There was an error executing the template. :(
                            errors.push(new TemplateExecutionError({
                                token: tok, error: err
                            }));
                            // TODO: Is this the right thing to do on error?
                            return next('{{ ' + tok.name + ' }}');
                        }
                        // Template loaded and executed fine, so we've got
                        // a result to hand off.
                        return next(result);
                    });
                
                } catch (e) {
                    // There was an error executing the template. :(
                    errors.push(new TemplateExecutionError({
                        token: tok, error: e
                    }));
                    // TODO: Is this the right thing to do on error?
                    return next('{{ ' + tok.name + ' }}');
                }

            });
        };

        // Create a queue for processing macros
        var q = async.queue(process_macro_fn,
                            this.options.queue_concurrency);

        // This finishes everything up, once the queue has been exhausted.
        q.drain = function (err) {
            // Build result out of text tokens or unique macro evaluations.
            var result = _.map(tokens, function (tok) {
                if ('TEXT' == tok.type) {
                    return tok.out;
                } else if ('MACRO' == tok.type) {
                    return macros[tok.hash].out;
                }
            }).join('');
            process_done(errors.length ? errors : null, result);
        };

        // Scan through the tokens, collect text nodes and queue unique macros.
        tokens.forEach(function (tok) {
            if ('TEXT' == tok.type) {
                // Doing nothing, here. But, we could conceivably filter text
                tok.out = tok.chars;
            } else if ('MACRO' == tok.type) {
                // Hash the macro name and args, to identify unique calls.
                tok.hash = crypto.createHash('md5')
                    .update(tok.name).update(tok.args.join(','))
                    .digest('hex');
                // If we haven't seen this macro before...
                if (!(tok.hash in macros)) {
                    // Queue the macro up to be processed, identified by hash.
                    macros[tok.hash] = tok;
                    q.push(tok.hash);
                }
            }
        });

    }

});

// ### BaseError
// Generic error found during macro evaluation process
var BaseError = ks_utils.Class({
    default_options: {
    },
    initialize: function () {
        this.message = this.getMessage();
    },
    getMessage: function () {
        var e = this.options.error;
        if (this.options.message) {
            return this.options.message;
        } else if (e) {
            return e.message;
        }
    }
});

// ### DocumentParsingError
// Represents an error found during parsing a document for macros
var DocumentParsingError = ks_utils.Class(BaseError, {
    name: 'DocumentParsingError',
    initialize: function (options) {
        var e = this.options.error;
        if ('SyntaxError' == e.name) {
            this.message = [
                "Syntax error at line ", e.line,
                ", column ", e.column, ": ",
                e.message
            ].join('');
        } else {
            this.message = e.message;
        }
    }
});

// ### TemplateError
// Generic error during template processing
var TemplateError = ks_utils.Class(BaseError, {
    getMessage: function () {
        var token = this.options.token;
        return [ 
            this.description,
            ' for macro {{ ',
            token.name,
            " (", JSON.stringify(token.args).slice(1, -1), ")",
            ' }} at offset ',
            token.offset,
            ': ',
            this.options.error
        ].join('');
    }
});

// ### TemplateLoadingError
// Error found during loading a template
var TemplateLoadingError = ks_utils.Class(TemplateError, {
    name: 'TemplateLoadingError',
    description: 'Problem loading template'
});

// ### TemplateExecutionError
// Error found during executing a template for macro evaluation
var TemplateExecutionError = ks_utils.Class(TemplateError, {
    name: 'TemplateExecutionError',
    description: 'Problem executing template'
});

// ### Exported public API
module.exports = {
    MacroProcessor: MacroProcessor,
    DocumentParsingError: DocumentParsingError,
    TemplateLoadingError: TemplateLoadingError,
    TemplateExecutionError: TemplateExecutionError
};
