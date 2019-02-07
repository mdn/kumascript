/**
 * @prettier
 */

// Provides utilities that as a whole constitute the macro test framework.

const fs = require('fs');
const path = require('path');
const Environment = require('../../src/environment.js');
const Templates = require('../../src/templates.js');

// When we were doing mocha testing, we used this.macro to hold this.
// But Jest doesn't use the this object, so we just store the object here.
let macro = null;

function assert(x) {
    expect(x).toBe(true);
}

assert.equal = (x, y) => {
    expect(x).toEqual(y);
};

assert.eventually = {
    async equal(x, y) {
        expect(await x).toEqual(y);
    }
};

assert.include = (list, element) => {
    expect(list).toContain(element);
};
assert.isTrue = value => {
    expect(value).toEqual(true);
};
assert.isFalse = value => {
    expect(value).toEqual(false);
};
assert.isAbove = (value, floor) => {
    expect(value).toBeGreaterThan(floor);
};
assert.isArray = value => {
    expect(value).toBeInstanceOf(Array);
};
assert.isObject = value => {
    expect(value).toBeInstanceOf(Object);
};
assert.isFunction = value => {
    expect(value).toBeInstanceOf(Function);
};
assert.property = (value, prop) => {
    expect(value).toHaveProperty(prop);
};
assert.notProperty = (value, prop) => {
    expect(value).not.toHaveProperty(prop);
};
assert.sameMembers = (a1, a2) => {
    expect(new Set(a1)).toEqual(new Set(a2));
};

function createMacroTestObject(macroName) {
    let templates = new Templates(__dirname + '/../../macros/');
    let pageContext = {
        locale: 'en-US',
        url: 'https://developer.mozilla.org/'
    };
    let environment = new Environment(pageContext, templates, true);
    let ctx = environment.prototypeEnvironment;

    /** @type {Map<string, string>} */
    const macroResults = new Map();
    const realTemplate = ctx.template;
    ctx.template = jest.fn(async (name, ...args) => {
        let macroName = String(name)
            .replace(/:/g, '-')
            .toLowerCase();
        return macroResults.get(macroName) || realTemplate(name, ...args);
    });

    return {
        /**
         * Give the test-case writer access to the macro's globals (ctx).
         * For example, "macro.ctx.env.locale" can be manipulated to something
         * other than 'en-US' or "macro.ctx.wiki.getPage" can be mocked
         * using `jest.fn()` to avoid network calls.
         */
        ctx,

        /**
         * A much easier way to handle overwriting the result of the `template`
         * function for specific macro calls.
         *
         * @param {string} name
         * @param {string} result
         */
        mockTemplate(name, result) {
            macroResults.set(name.replace(/:/g, '-').toLowerCase(), result);
        },

        /**
         * Use this function to make test calls on the named macro, if
         * applicable.  Its arguments become the arguments to the
         * macro. It returns a promise.
         */
        async call(...args) {
            let rendered = await templates.render(
                macroName,
                environment.getExecutionContext(args)
            );
            return rendered;
        }
    };
}

/**
 * This is the essential function for testing macros. Use it as
 * you would use mocha's "describe", with the exception that the
 * first argument must be the name of the macro being tested.
 *
 * @param {string} macroName
 * @param {function():void} runTests
 */
function describeMacro(macroName, runTests) {
    describe(`test "${macroName}"`, function() {
        beforeEach(function() {
            macro = createMacroTestObject(macroName);
        });
        runTests();
    });
}

/**
 * Syntactic sugar that avoids thinking about the mocha context "this".
 * Use this function as you would use mocha's "it", with the exception
 * that the callback function ("runTest" in this case) should accept a
 * single argument that is the macro test object.
 *
 * @param {string} title
 * @param {function(Macro):void} runTest
 */
function itMacro(title, runTest) {
    it(title, function() {
        // Assumes that setup returns a promise (if async) or
        // undefined (if synchronous).
        return runTest(macro);
    });
}

/**
 * Syntactic sugar that avoids thinking about the mocha context "this". Use
 * this function as you would use mocha's "beforeEach", with the exception
 * that the callback function ("setup" in this case) should accept a single
 * argument that is the macro test object.
 *
 * @param {function(Macro):void} setup
 */
function beforeEachMacro(setup) {
    beforeEach(function() {
        // Assumes that setup returns a promise (if async) or
        // undefined (if synchronous).
        return setup(macro);
    });
}

/**
 * Syntactic sugar that avoids thinking about the mocha context "this". Use
 * this function as you would use mocha's "afterEach", with the exception
 * that the callback function ("teardown" in this case) should accept a single
 * argument that is the macro test object.
 *
 * @param {function(Macro):void} teardown
 */
function afterEachMacro(teardown) {
    afterEach(function() {
        // Assumes that teardown returns a promise (if async) or
        // undefined (if synchronous).
        return teardown(macro);
    });
}

/**
 * Reads a JSON fixture file from the `fixtures` directory.
 *
 * @param {...string} filePath
 */
function readJSONFixture(...filePath) {
    let fileName = filePath.pop();
    if (!path.extname(fileName)) {
        fileName += '.json';
    }
    let absolutePath = path.resolve(
        __dirname,
        'fixtures',
        ...filePath,
        fileName
    );
    return JSON.parse(fs.readFileSync(absolutePath));
}

// ### Exported public API
module.exports = {
    assert,
    itMacro,
    describeMacro,
    afterEachMacro,
    beforeEachMacro,
    readJSONFixture
};
