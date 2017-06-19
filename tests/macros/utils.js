/* jshint node: true, mocha: true, esversion: 6 */

// Provides utilities that as a whole constitute the macro test framework.

var sinon = require('sinon'),
    kumascript = require('../..'),
    // Only do this once, since it crawls the file system.
    loader = new kumascript.loaders.FileLoader();

function createMacroTestObject(name, done) {
    var ctx = new kumascript.api.APIContext({
            errors: [],
            source: '',
            loader: loader,
            log: sinon.spy(),
            env: {
                locale: 'en-US',
                url: 'https://developer.mozilla.org/'
            },
            autorequire: {
                'mdn': 'MDN-Common',
                'Page': 'DekiScript-Page',
                'String': 'DekiScript-String',
                'Uri': 'DekiScript-Uri',
                'Web': 'DekiScript-Web',
                'Wiki': 'DekiScript-Wiki'
            },
        }),
        macro = {};

    /**
     * Give the test-case writer access to the macro's globals (ctx).
     * For example, "macro.ctx.env.locale" can be manipulated to something
     * other than 'en-US' or "macro.ctx.wiki.getPage" can be mocked
     * using "sinon.stub()" to avoid network calls.
     */
    macro.ctx = ctx;

    /**
     * Use this function to make test calls on the named macro. Its
     * arguments become the arguments to the macro. It returns a promise.
     */
    macro.call = function () {
        // Make the arguments accessible within the macro.
        macro.ctx.setArguments(arguments);
        return new Promise(function (resolve, reject) {
            loader.get(name, function (err, tmpl, cache_hit) {
                if (err) {
                    // Loading errors should abort the test.
                    throw err;
                } else {
                    // Actually execute the macro.
                    tmpl.execute(null, macro.ctx, function (err, result) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                    });
                }
            });
        });
    };

    // Load the auto-required macros into the "ctx" object.
    macro.ctx.performAutoRequire(done);

    return macro;
}

/**
 * This is the essential function for testing macros. Use it as
 * you would use mocha's "describe", with the exception that the
 * first argument must be the name of the macro being tested.
 */
function describeMacro(macroName, runTests) {
    describe(`test "${macroName}"`, function () {
        beforeEach(function (done) {
            this.macro = createMacroTestObject(macroName, done);
        });
        runTests();
    });
}

/**
 * Syntactic sugar that avoids thinking about the mocha context "this".
 * Use this function as you would use mocha's "it", with the exception
 * that the callback function ("runTest" in this case) should accept a
 * single argument that is the macro test object.
 */
function itMacro(title, runTest) {
    it(title, function () {
        // Assumes that setup returns a promise (if async) or
        // undefined (if synchronous).
        return runTest(this.macro);
    });
}

/**
 * Syntactic sugar that avoids thinking about the mocha context "this". Use
 * this function as you would use mocha's "beforeEach", with the exception
 * that the callback function ("setup" in this case) should accept a single
 * argument that is the macro test object.
 */
function beforeEachMacro(setup) {
    beforeEach(function () {
        // Assumes that setup returns a promise (if async) or
        // undefined (if synchronous).
        return setup(this.macro);
    });
}

/**
 * Syntactic sugar that avoids thinking about the mocha context "this". Use
 * this function as you would use mocha's "afterEach", with the exception
 * that the callback function ("teardown" in this case) should accept a single
 * argument that is the macro test object.
 */
function afterEachMacro(teardown) {
    afterEach(function () {
        // Assumes that teardown returns a promise (if async) or
        // undefined (if synchronous).
        return teardown(this.macro);
    });
}

// ### Exported public API
module.exports = {
    itMacro: itMacro,
    describeMacro: describeMacro,
    afterEachMacro: afterEachMacro,
    beforeEachMacro: beforeEachMacro
};
