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
        queue_concurrency: 1
    },

    // #### Process macros in content
    process: function (src, api_ctx, process_done) {
        var $this = this,
            errors = [],
            templates = {},
            macros = {};

        // Clone general loader options, since we'll tweak them per-request.
        var loader_options = _.clone($this.options.loader_options);
        if (api_ctx.env && api_ctx.env.cache_control) {
            // Pass along Cache-Control header, if any.
            loader_options.cache_control = api_ctx.env.cache_control;
        }
        var loader = new $this.options.loader_class(loader_options);

        // Attempt to parse the document, trap errors
        var tokens = [];
        try { tokens = ks_parser.parse(src); }
        catch (e) {
            errors.push(new DocumentParsingError({error: e, src: src}));
            return process_done(errors, src);
        }

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
                    templates[tok.name] = false;
                }
            }
        });

        // Give the API context access to the loader and errors
        api_ctx.loader = loader;
        api_ctx.errors = errors;

        // Kick off loading any autorequire templates.
        api_ctx.performAutoRequire(function (err) {
            if (err) {
                errors.push(new TemplateLoadingError({ error: err }));
            }
            // Load all the templates...
            $this.loadTemplates(loader, templates, src, function (tmpl_errors) {
                // Evaluate all the macros....
                $this.evaluateMacros(api_ctx, templates, macros, src, function (macro_errors) {
                    // Assemble the body of the response, and we're done.
                    var result = _.map(tokens, function (tok) {
                        if ('TEXT' == tok.type) {
                            return tok.out;
                        } else if ('MACRO' == tok.type) {
                            return macros[tok.hash].out;
                        }
                    }).join('');
                    var errors = [].concat(tmpl_errors, macro_errors);
                    process_done(errors.length ? errors : null, result);
                });
            });
        });
    },

    // #### Load templates
    loadTemplates: function (loader, templates, src, next_cb) {
        var $this = this,
            errors = [],
            names = _.keys(templates);
        if (!names.length) { return next_cb(errors); }

        var template_q = async.queue(function (name, q_next) {
            try {
                loader.get(name, function (err, tmpl) {
                    if (!err) {
                        templates[name] = tmpl;
                    } else {
                        // There was an error loading the template. :(
                        errors.push(new TemplateLoadingError({
                            name: name, error: err
                        }));
                    }
                    q_next();
                });
            } catch (e) {
                // There was an error executing the template. :(
                errors.push(new TemplateLoadingError({
                    name: name, error: e
                }));
                q_next();
            }
        }, $this.options.queue_concurrency);

        template_q.drain = function (err) { next_cb(errors); };
        names.forEach(function (name) { template_q.push(name); });
    },

    // #### Evaluate macros
    evaluateMacros: function (api_ctx, templates, macros, src, next_cb) {
        var $this = this,
            errors = [],
            hashes = _.keys(macros);

        if (!hashes.length) { return next_cb(errors); }
    
        var macro_q = async.queue(function (hash, q_next) {
            var tok = macros[hash];
            var next = function (out) {
                tok.out = out;
                q_next();
            };

            // Make sure the template was loaded...
            var tmpl = templates[tok.name];
            if (!tmpl) { return next('{{ ' + tok.name + ' }}'); }
            try {
                // Try executing the template with macro arguments
                clone_ctx = _.clone(api_ctx).setArguments(tok.args);
                tmpl.execute(tok.args, clone_ctx, function (err, result) {
                    if (err) { 
                        // There was an error executing the template. :(
                        errors.push(new TemplateExecutionError({
                            token: tok, error: err, src: src
                        }));
                        return next('{{ ' + tok.name + ' }}');
                    }
                    return next(result);
                });
            } catch (e) {
                // There was an error executing the template. :(
                errors.push(new TemplateExecutionError({
                    token: tok, error: e, src: src
                }));
                return next('{{ ' + tok.name + ' }}');
            }

        }, $this.options.queue_concurrency);

        hashes.forEach(function (hash) { macro_q.push(hash); });
        macro_q.drain = function (err) { next_cb(errors); };
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
    
    // #### getLines
    // Split the doc source into lines.
    getLines: function () {
        return (''+this.options.src).split(/\r\n|\r|\n/);
    },
    
    // #### makeColPointer
    // Make an ASCII art arrow that points at a column -----^
    makeColPointer: function (idx) {
        var arrow = [],
            arrow_pos = idx + 7;
        for (var i=0; i<arrow_pos; i++) {
            arrow.push('-');
        }
        arrow.push('^');
        return arrow.join('');
    },

    // #### formatErrorLine
    // Format a line of error context, with padded right-justified number and
    // separator.
    formatErrorLine: function (i, line) {
        var lnum = ('      ' + (i+1)).substr(-5);
        return lnum + ' | ' + line;
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
            var lines = this.getLines();

            // Work out a range of lines to show for context around the error,
            // 2 before and after.
            var l_idx = e.line - 1,
                i_start = Math.max(l_idx-2, 0),
                i_end   = Math.min(l_idx+3, lines.length);

            // Build a pointer like ----^ that indicates the error column.
            var arrow = this.makeColPointer(e.column);

            // Assemble the lines of error context, inject the column pointer
            // at the appropriate spot after the error line.
            var ctx = [];
            for (var i=i_start; i<i_end; i++) {
                ctx.push(this.formatErrorLine(i, lines[i]));
                if (i == l_idx) { ctx.push(arrow); }
            }

            // Finally, assemble the complete error message.
            this.message = [
                "Syntax error at line ", e.line,
                ", column ", e.column, ": ",
                e.message,
                "\n", ctx.join("\n")
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
        var name = this.options.name;
        return [ 
            this.description,
            ' for template ',
            name,
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
    description: 'Problem executing template',

    initialize: function (options) {
        var lines = this.getLines(),
            tok = this.options.token,
            offset = tok.offset;

        var lines_before = [],
            err_line = null,
            err_col = 0,
            cnt = 0;

        // Run through lines, accumulating a character counter so we can
        // extract the lines before, the line of the error, and the lines after
        // the error.
        while (lines.length) {

            // Shift the next line off the top of the list of lines. This will
            // end up being either another line before the error, or the error
            // itself.
            var line = lines.shift(),
                len = line.length;

            if ((cnt + len) > offset) { 
                // This is the line of the error, so grab the line and
                // calculate the remaining character offset to find the column
                // within the line.
                err_line = line;
                err_col = offset - cnt;
                break;
            } else {
                // This isn't the error line, yet. So, push this onto the end
                // of the lines before the error.
                cnt += (len + 1);
                lines_before.push(line);
            }
        }

        // Assemble a set of lines before, including, and after where the error
        // occurred. Also, inject an ASCI art pointer to indicate the column
        // where the error occurred.
        var ctx = [],
            before_start = Math.max(lines_before.length - 2, 0),
            line_num = before_start,
            after_end = Math.min(2, lines.length),
            arrow = this.makeColPointer(err_col + 1);

        for (var i=before_start; i<lines_before.length; i++) {
            ctx.push(this.formatErrorLine(line_num++, lines_before[i]));
        }
        ctx.push(this.formatErrorLine(line_num++, err_line));
        ctx.push(arrow);
        for (var j=0; j<after_end; j++) {
            ctx.push(this.formatErrorLine(line_num++, lines[j]));
        }

        // Finally, assemble the complete error message.
        this.message = [
            'Problem executing template ', tok.name, ': ', this.options.error,
            "\n",
            ctx.join("\n")
        ].join('');
    }

});

// ### Exported public API
module.exports = {
    MacroProcessor: MacroProcessor,
    DocumentParsingError: DocumentParsingError,
    TemplateLoadingError: TemplateLoadingError,
    TemplateExecutionError: TemplateExecutionError
};
