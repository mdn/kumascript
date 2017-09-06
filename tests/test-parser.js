/* jshint node: true, mocha: true, esversion: 6 */

var PEG = require("pegjs"),
    fs = require("fs"),
    assert = require('chai').assert,
    ks_parser_fn = __dirname + '/../lib/kumascript/parser.pegjs',
    ks_parser_src = fs.readFileSync(ks_parser_fn, 'utf8'),
    ks_parser = PEG.buildParser(ks_parser_src);

describe('test-parser', function () {
    it('JSON values are parsed correctly', function () {
        "use strict";
        var tokens = ks_parser.parse(
            '{{ f({ "a": "x", "b": -1e2, "c": 0.5, "d": [1,2, 3] }) }}'
        );
        assert.deepEqual(
            tokens,
            [{ type: "MACRO",
               name: "f",
               args: [{a: "x", b: -1e2, c: 0.5, d: [1, 2, 3]}],
               offset: 0
            }],
            "The macro is parsed correctly"
        );
    });

    it('JSON parameter should allow a single-item list', function () {
        "use strict";
        var tokens = ks_parser.parse('{{ f({ "a": ["one"] }) }}');
        assert.deepEqual(
            tokens,
            [{ type: "MACRO",
               name: "f",
               args: [{a: ["one"]}],
               offset: 0
            }],
            "The macro is parsed correctly"
        );
    });

    it('Invalid JSON should cause a syntax error', function () {
        "use strict";
        assert.throws(
            function() {
                ks_parser.parse('{{ f({ x: 1 }) }}');
            },
            /^SyntaxError: .+$/,
            "Quotes around property names are required"
        );

        assert.throws(
            function() {
                ks_parser.parse('{{ f({ "x": 01 }) }}');
            },
            /^SyntaxError: .+$/,
            "Octal literals are not allowed"
         );

        assert.throws(
            function() {
                ks_parser.parse('{{ f({ "x": [1,] }) }}');
            },
            /^SyntaxError: .+$/,
            "Trailing commas are not allowed"
        );
    });

    it("JSON strings should be able to contain ')'", function () {
        "use strict";
        var tokens = ks_parser.parse('{{ f({ "a": "f)" }) }}');
        assert.deepEqual(
            tokens,
            [{ type: "MACRO",
               name: "f",
               args: [{a: "f)"}],
               offset: 0
            }],
            "The macro is parsed correctly"
        );
    });

    it('Empty JSON values are allowed', function () {
        "use strict";
        var tokens = ks_parser.parse('{{ f({}) }}');
        assert.deepEqual(
            tokens,
            [{ type: "MACRO",
               name: "f",
               args: [{}],
               offset: 0
            }],
            "Empty JSON objects are parsed correctly"
        );

        tokens = ks_parser.parse('{{ f({ "a": [] }) }}');
        assert.deepEqual(
            tokens,
            [{ type: "MACRO",
               name: "f",
               args: [{a: []}],
               offset: 0
            }],
            "Empty JSON objects are parsed correctly"
        );
    });

    it('Escaped unicode codepoints are parsed correctly', function () {
        "use strict";
        var tokens = ks_parser.parse('{{ f({ "a": "\\u00f3" }) }}');
        assert.deepEqual(
            tokens,
            [{ type: "MACRO",
               name: "f",
               args: [{a: "\u00f3"}],
               offset: 0
            }],
            "Lowercase hex digits are parsed correctly"
        );

        tokens = ks_parser.parse('{{ f({ "a": "\\u00F3" }) }}');
        assert.deepEqual(
            tokens,
            [{ type: "MACRO",
               name: "f",
               args: [{a: "\u00f3"}],
               offset: 0
            }],
            "Uppercase hex digits are parsed correctly"
        );

        assert.throws(
            function() {
                ks_parser.parse('{{ f({ "a": "\\uGHIJ" }) }}');
            },
            /^SyntaxError: .+$/,
            "Non-hexadecimal characters are not allowed"
        );

        assert.throws(
            function() {
                ks_parser.parse('{{ f({ "a": "\\uFF" }) }}');
            },
            /^SyntaxError: .+$/,
            "Four digits are required"
        );
    });
});
