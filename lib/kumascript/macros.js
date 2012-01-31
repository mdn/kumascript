var util = require('util');

var macro_re = RegExp("\\{\\{([^\\}]+)\\}\\}", "gi"),
    parts_re = RegExp("([^\\(]+)(\\([^\\)]+\\))?"),
    param_re = /\s*\(\s*(.*)\s*\)\s*/;

var $this = module.exports = {
    
    process: function (src, exec_fn) {
        return src.replace(macro_re, function (s, s1) {
            var r = parts_re.exec(s1.trim()),
                macro_name = r[1].trim(),
                ar = param_re.exec(r[2] || '()'),
                args = $this.CSVtoArray(ar[1]);
            return exec_fn(macro_name, args);
        });
    },

    // http://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript
    CSVtoArray: function (text) {
        var re_valid = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
        var re_value = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
        // Return NULL if input string is not well formed CSV string.
        if (!re_valid.test(text)) return null;
        var a = [];                     // Initialize array to receive values.
        text.replace(re_value, // "Walk" the string using replace with callback.
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

};
