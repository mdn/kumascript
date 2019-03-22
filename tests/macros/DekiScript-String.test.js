/**
 * @prettier
 */

// There used to be a DekiScript-String.ejs macro, and this test
// tested its main functions. The features of that macro are now
// part of ../../src/environment.js, but we're still testing them here.

// Get necessary modules
const { assert, describeMacro, itMacro } = require('./utils');

describeMacro('DekiScript:String', () => {
    itMacro('require', macro => {
        let pkg = macro.ctx.string;
        assert.isObject(pkg);
        assert.isFunction(pkg.startsWith);
        assert.isFunction(pkg.endsWith);
        assert.isFunction(pkg.contains);
        assert.isFunction(pkg.deserialize);
        assert.isFunction(pkg.isDigit);
        assert.isFunction(pkg.isLetter);
        assert.isFunction(pkg.serialize);
        assert.isFunction(pkg.substr);
        assert.isFunction(pkg.toLower);
        assert.isFunction(pkg.toUpperFirst);
        assert.isFunction(pkg.trim);
        assert.isFunction(pkg.remove);
        assert.isFunction(pkg.replace);
        assert.isFunction(pkg.join);
        assert.isFunction(pkg.length);
    });
});
