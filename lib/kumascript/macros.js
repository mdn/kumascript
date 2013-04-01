// ## KumaScript macro processing
//
// This is where the magic happens, with regards to finding, inventorying, and
// executing macros in content.

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    crypto = require('crypto'),
    hirelings = require('hirelings'),
    EventEmitter = require('events').EventEmitter,
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
var MacroProcessor = ks_utils.Class(EventEmitter, {

    // #### Default options
    default_options: {
        loader: {
            module: __dirname + '/loaders',
            class_name: 'HTTPLoader',
            options: {
                filename_template: __dirname + '/fixtures/templates/{name}.ejs'
            }
        },
        memcache: null,
        queue_concurrency: 4,
        macro_timeout: 2000
    },

    initialize: function (options) {
        this.statsd = ks_utils.getStatsD(this.options);
    },

    startup: function (next) {
        this.worker_pool = new hirelings.Pool({
            module: __dirname + '/macros-worker.js',
            concurrency: 16,
            max_jobs_per_process: 32,
            options: {
                autorequire: this.options.autorequire,
                loader: this.options.loader,
                memcache: this.options.memcache
            }
        });
        return next();
    },

    shutdown: function (next) {
        if (this.worker_pool) { this.worker_pool.exit(); }
        return next();
    },

    // #### Process macros in content
    process: function (src, ctx, process_done) {
        var $this = this;
        var errors = [];
        var macros = {};

        function _done(errors, src) {
            if (!errors.length) errors = null;
            return process_done(errors, src);
        }

        // Attempt to parse the document, trap errors
        var tokens = [];
        try { tokens = ks_parser.parse(src); }
        catch (e) {
            errors.push(new DocumentParsingError({error: e, src: src}));
            return _done(errors, src);
        }

        var autorequire = $this.options.autorequire;
        var templates_to_reload = [];
        if (ctx.env && 'no-cache' == ctx.env.cache_control) {
            // Extract a unique list of template names used in macros.
            var template_names = _.chain(tokens)
                .filter(function (tok) { return 'MACRO' == tok.type; })
                .map(function (tok) { return tok.name; })
                .uniq().value();
                
            // Templates to flush include those used in macros and
            // autorequired modules
            templates_to_reload = _.union(template_names, _.values(autorequire)); 
        }

        // Intercept the logger from context, if present.
        var log = null;
        if ('log' in ctx) {
            log = ctx.log;
        }

        // Macro processing queue managing process of sending jobs to the
        // evaluation cluster.
        //
        // Yes, this is an (internal) queue managing submissions to another
        // (external) queue. But, it limits the number of concurrent jobs per
        // document, and tells us when this document's macros are done.
        var macro_q = async.queue(function (hash, q_next) {
            var token = macros[hash];
            var work = {
                token: token,
                src: src,
                ctx: ctx
            };
            var job = $this.worker_pool.enqueue(work, function (err, rv) {
                if (err) {
                    errors.push(new TemplateExecutionError({
                        error: err,
                        stack: '',
                        name: token.name,
                        src: src,
                        token: token
                    }));
                    token.out = '{{ ' + token.name + ' }}';
                } else if (rv.error) {
                    var err_cls = rv.error[0];
                    var err_opts = rv.error[1];
                    errors.push(new module.exports[err_cls](err_opts));
                    token.out = '{{ ' + token.name + ' }}';
                } else {
                    if (log && rv.log_events) {
                        for (var i=0,event; event=rv.log_events[i]; i++) {
                            log[event[0]].apply(log, event[1]);
                        }
                    }
                    token.out = rv.result;
                }
                q_next();
            });
        }, $this.options.queue_concurrency);

        // Before queueing macros for processing, reload templates (if any)
        $this.reloadTemplates(templates_to_reload, function (err) {
            
            // Scan through the tokens, queue unique macros for evaluation.
            tokens.forEach(function (token) {
                if ('MACRO' == token.type) {
                    token.hash = $this.hashTokenArgs(token);
                    if (!(token.hash in macros)) {
                        macros[token.hash] = token;
                        macro_q.push(token.hash);
                    }
                }
            });

            // Exit point when the processing queue has drained.
            macro_q.drain = function (err) {
                // Assemble output text by gluing together text tokens and the
                // results of macro evaluation.
                var src_out = _.map(tokens, function (token) {
                    if ('TEXT' == token.type) {
                        return token.chars;
                    } else if ('MACRO' == token.type) {
                        return macros[token.hash].out;
                    }
                }).join('');
                return _done(errors, src_out);
            }

            // If no macros were queued up, jump straight to drain.
            if (0 == macro_q.length()) { macro_q.drain(); }

        });
    },

    // #### Produce a unique hash for macro
    // A macro's unique hash encompasses the template name and the arguments
    hashTokenArgs: function (token) {
        // Hash the macro name and args, to identify unique calls.
        var hash = crypto.createHash('md5').update(token.name);
        if (token.args.length > 0) {
            // Update the hash with arguments, if any...
            if (_.isObject(token.args[0])) {
                // JSON-style args, so stringify the object.
                hash.update(JSON.stringify(token.args));
            } else {
                // Otherwise, this is a simple string list.
                hash.update(token.args.join(','));
            }
        }
        return hash.digest('hex');
    },

    // #### Force-reload the named templates, if any.
    reloadTemplates: function (names, done) {
        if (0 == names.length) { return done(); }
        try {
            var loader_module = require(this.options.loader.module);
            var loader_class = loader_module[this.options.loader.class_name];
            var loader_options = _.clone(this.options.loader.options);

            // Use a Cache-Control header that forces a fresh cache.
            loader_options.cache_control = 'max-age=0';

            var loader = new loader_class(loader_options);
            async.forEach(names, function (name, e_next) {
                loader.get(name, e_next);
            }, done);
        } catch (e) {
            done(e);
        }
    }

});

// ### BaseError
// Generic error found during macro evaluation process
var BaseError = ks_utils.Class({
    name: 'BaseError',
    default_options: {
    },
    
    initialize: function (options) {
        if (this.options.error && this.options.error.stack) {
            this.stack = this.options.error.stack;
        }
        this.message = this.options.message ? this.options.message :
                                              this.getMessage();
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
            this.options.error,
            "\n",
            this.options.stack
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
    getMessage: function () {
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
        return [
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
