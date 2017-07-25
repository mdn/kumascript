/* jshint node: true, mocha: true, esversion: 6 */

// Provides utilities that as a whole constitute the macro test framework.

var sinon = require('sinon'),
    Fiber = require('fibers'),
    kumascript = require('../..'),
    // Only do this once, since it crawls the file system.
    loader = new kumascript.loaders.FileLoader();

function createMacroTestObject(name, done) {
    name = name.toLowerCase();

    var ctx = new kumascript.api.APIContext({
            errors: [],
            source: '',
            loader: loader,
            log: sinon.spy(),
            request: sinon.stub(),
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
     * Wrap a package object such that when a property of that package (which
     * we're assuming is a function for now) is requested, we'll wrap the
     * function call in a Fiber. We have to run the function within a Fiber
     * in order to mimic the enivironment in which it is normally called (
     * macros are executed within a Fiber because it allows macro coders to
     * write in a synchronous style).
     */
    function makePackageProxy (pkg) {
        return new Proxy(pkg, {
            get: function(target, prop_name) {
                if (prop_name in target) {
                    const func = target[prop_name];
                    return function () {
                        const args = arguments;
                        return Fiber(function () {
                            return func.apply(pkg, args);
                        }).run();
                    };
                }
                return undefined;
            }
        });
    }

    function makeCallFunction (for_package) {
        return function () {
            // Make the arguments accessible within the macro.
            if (!for_package) {
                macro.ctx.setArguments(arguments);
            }
            return new Promise(function (resolve, reject) {
                loader.get(name, function (err, tmpl, cache_hit) {
                    if (err) {
                        // Loading errors should abort the test.
                        throw err;
                    } else {
                        if (for_package) {
                            macro.ctx.module = { exports: {} };
                            macro.ctx.exports = macro.ctx.module.exports;
                        }
                        // Actually execute the macro.
                        tmpl.execute(null, macro.ctx, function (err, result) {
                            if (err) {
                                reject(err);
                            } else if (for_package) {
                                var pkg = macro.ctx.module.exports;
                                resolve(makePackageProxy(pkg));
                            } else {
                                resolve(result);
                            }
                        });
                    }
                });
            });
        };
    }

    /**
     * Use this function to make test calls on the named macro, if applicable.
     * Its arguments become the arguments to the macro. It returns a promise.
     */
    macro.call = makeCallFunction(false);

    /**
     * Use this function to "require" the named macro (load it as a package),
     * if applicable. It takes no arguments, and returns a promise.
     */
    macro.require = makeCallFunction(true);

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
