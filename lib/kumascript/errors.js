/* jshint node: true */

var ks_utils = require(__dirname + '/utils');

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
            "Problem executing template ", tok.name, ":\n",
            ctx.join("\n"),
            "\n\n",
            this.options.stack || (''+this.options.error)
        ].join('');
    }

});

// ### Exported public API
module.exports = {
    DocumentParsingError: DocumentParsingError,
    TemplateLoadingError: TemplateLoadingError,
    TemplateExecutionError: TemplateExecutionError
};
