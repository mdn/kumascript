"use strict";

var PEG = require("pegjs"),
    fs = require("fs"),
    nodeunit = require('nodeunit'),

    ks_parser_fn = __dirname + '/../lib/kumascript/parser.pegjs',
    ks_parser_src = fs.readFileSync(ks_parser_fn, 'utf8'),
    ks_parser = PEG.buildParser(ks_parser_src);

module.exports = nodeunit.testCase({
  "JSON values are parsed correctly": function (test) {
    var tokens = ks_parser.parse('{{ f({ "a": "x", "b": -1e2, "c": 0.5, "d": [1,2, 3] }) }}');
    test.deepEqual(tokens,
                   [{type: "MACRO",
                     name: "f",
                     args: [{a: "x", b: -1e2, c: 0.5, d: [1, 2, 3]}],
                     offset: 0}],
                   "The macro is parsed correctly");
    test.done();
  },

  "JSON parameter should allow a single-item list": function (test) {
    var tokens = ks_parser.parse('{{ f({ "a": ["one"] }) }}');
    test.deepEqual(tokens,
                   [{type: "MACRO",
                     name: "f",
                     args: [{a: ["one"]}],
                     offset: 0}],
                   "The macro is parsed correctly");
    test.done();
  },

  "Invalid JSON should cause a syntax error": function (test) {
    test.throws(function() {
      ks_parser.parse('{{ f({ x: 1 }) }}');
    }, PEG.parser.SyntaxError, "Quotes around property names are required");

    test.throws(function() {
      ks_parser.parse('{{ f({ "x": 01 }) }}');
    }, PEG.parser.SyntaxError, "Octal literals are not allowed");

    test.throws(function() {
      ks_parser.parse('{{ f({ "x": [1,] }) }}');
    }, PEG.parser.SyntaxError, "Trailing commas are not allowed");

    test.done();
  },

  "JSON strings should be able to contain ')'": function (test) {
    var tokens = ks_parser.parse('{{ f({ "a": "f)" }) }}');
    test.deepEqual(tokens,
                   [{type: "MACRO", name: "f", args: [{a: "f)"}], offset: 0}],
                   "The macro is parsed correctly");
    test.done();
  },

  "Empty JSON values are allowed": function (test) {
    var tokens = ks_parser.parse('{{ f({}) }}');
    test.deepEqual(tokens, [{type: "MACRO", name: "f", args: [{}], offset: 0}],
                   "Empty JSON objects are parsed correctly");

    tokens = ks_parser.parse('{{ f({ "a": [] }) }}');
    test.deepEqual(tokens, [{type: "MACRO", name: "f", args: [{a: []}], offset: 0}],
                   "Empty JSON objects are parsed correctly");
    test.done();
  },

  "Escaped Unicode codepoints are parsed correctly": function (test) {
    var tokens = ks_parser.parse('{{ f({ "a": "\\u00f3" }) }}');
    test.deepEqual(tokens,
                   [{type: "MACRO", name: "f", args: [{a: "\u00f3"}], offset: 0}],
                   "Lowercase hex digits are parsed correctly");

    var tokens = ks_parser.parse('{{ f({ "a": "\\u00F3" }) }}');
    test.deepEqual(tokens,
                   [{type: "MACRO", name: "f", args: [{a: "\u00f3"}], offset: 0}],
                   "Uppercase hex digits are parsed correctly");

    test.throws(function() {
      ks_parser.parse('{{ f({ "a": "\\uGHIJ" }) }}');
    }, PEG.parser.SyntaxError, "Non-hexadecimal characters are not allowed");

    test.throws(function() {
      ks_parser.parse('{{ f({ "a": "\\uFF" }) }}');
    }, PEG.parser.SyntaxError, "Four digits are required");

    test.done();
  }
});
