/**
 * @prettier
 */

// Provides utilities that as a whole constitute the macro test framework.
const { execSync } = require('child_process');
const os = require('os');

const vnu = require('vnu-jar');

const Environment = require('../../src/environment.js');
const Templates = require('../../src/templates.js');

// TODO: Maybe use a class for this?
/**
 * @typedef Macro
 * @property {typeof Environment.prototype.prototypeEnvironment} ctx
 *           Give the test-case writer access to the macro's globals (ctx).
 *           For example, "macro.ctx.env.locale" can be manipulated to something
 *           other than 'en-US' or "macro.ctx.wiki.getPage" can be mocked
 *           using `jest.fn()` to avoid network calls.
 *
 * @property {(name: string, result: string) => void} mockTemplate
 *           When writing tests for a macro that invokes other macros with
 *           the `template()` function, you sometimes want to specify
 *           a mock return value for those other macros.
 *
 *           This function provides a much easier way to handle that than
 *           using `jest.fn()` directly.
 *
 *           To unmock a template result, simply call `unmockTemplate()`
 *           with the same `name`.
 *
 * @property {(name: string) => boolean} unmockTemplate
 *           Stops mocking the result of a `template()` function call.
 *
 * @property {(...args: any[]) => Promise<string>} call
 *           Use this function to make test calls on the named macro, if applicable.
 *           Its arguments become the arguments to the macro. It returns a promise.
 */

/**
 * When we were doing mocha testing, we used this.macro to hold this.
 * But Jest doesn't use the this object, so we just store the object here.
 * @type {Macro}
 */
let macro = null;

/**
 * Asserts that value is truthy.
 *
 * @template T Type of value.
 * @param {T} x Actual value.
 */
function assert(x) {
    expect(x).toBeTruthy();
}

/**
 * Asserts non-strict equality (==) of actual and expected.
 *
 * @template T Type of the objects.
 * @param {T} x Actual value.
 * @param {any} y Potential expected value.
 */
assert.equal = (x, y) => {
    expect(x).toEqual(y);
};

assert.eventually = {
    /**
     * Asserts non-strict equality (==) of actual and expected.
     *
     * @template T Type of the objects.
     * @param {T|PromiseLike<T>} x Actual value.
     * @param {any} y Potential expected value.
     */
    async equal(x, y) {
        expect(await x).toEqual(y);
    }
};

/**
 * Asserts that value is true.
 *
 * @template T Type of value.
 * @param {T} value Actual value.
 */
assert.isTrue = value => {
    expect(value).toEqual(true);
};

/**
 * Asserts that value is false.
 *
 * @template T Type of value.
 * @param {T} value Actual value.
 */
assert.isFalse = value => {
    expect(value).toEqual(false);
};

/**
 * Asserts value is strictly greater than (>) floor.
 *
 * @param {number} value Actual value.
 * @param {number} floor Minimum Potential expected value.
 */
assert.isAbove = (value, floor) => {
    expect(value).toBeGreaterThan(floor);
};

/**
 * Asserts that value is an array.
 *
 * @template T Type of value.
 * @param {T} value Actual value.
 */
assert.isArray = value => {
    expect(value).toBeInstanceOf(Array);
};

/**
 * Asserts that value is an object of type 'Object'
 * (as revealed by Object.prototype.toString).
 *
 * @template T Type of value.
 * @param {T} value Actual value.
 * @remarks The assertion does match subclassed objects.
 */
assert.isObject = value => {
    expect(value).toBeInstanceOf(Object);
};

/**
 * Asserts that value is a function.
 *
 * @template T Type of value.
 * @param {T} value Actual value.
 */
assert.isFunction = value => {
    expect(value).toBeInstanceOf(Function);
};

/**
 * Asserts that object has a property named by property.
 *
 * @template T Type of object.
 * @param {T} value Container object.
 * @param {string} prop Potential contained property of object.
 */
assert.property = (value, prop) => {
    expect(value).toHaveProperty(prop);
};

/**
 * Asserts that object doesn't have a property named by property.
 *
 * @template T Type of object.
 * @param {T} value Container object.
 * @param {string} prop Potential contained property of object.
 */
assert.notProperty = (value, prop) => {
    expect(value).not.toHaveProperty(prop);
};

/**
 * Asserts that set1 and set2 have the same members. Order is not take into account.
 *
 * @template T Type of set values.
 * @param {T[]} a1 Actual set of values.
 * @param {T[]} a2 Potential expected set of values.
 */
assert.sameMembers = (a1, a2) => {
    expect(new Set(a1)).toEqual(new Set(a2));
};

/**
 * Asserts that haystack includes needle.
 *
 * @template T
 * @param {string|T[]} list Container string or array.
 * @param {string|T} element Potential value contained in haystack.
 */
assert.include = (list, element) => {
    expect(list).toContain(element);
};

/**
 * @param {string} macroName
 * @return {Macro}
 */
function createMacroTestObject(macroName) {
    let templates = new Templates(__dirname + '/../../macros/');
    let pageContext = {
        locale: 'en-US',
        url: 'https://developer.mozilla.org/'
    };
    let environment = new Environment(pageContext, templates, true);

    return {
        /**
         * Give the test-case writer access to the macro's globals (ctx).
         * For example, "macro.ctx.env.locale" can be manipulated to something
         * other than 'en-US' or "macro.ctx.wiki.getPage" can be mocked
         * using "sinon.stub()" to avoid network calls.
         */
        ctx: environment.prototypeEnvironment,

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
 * This function validates its input as HTML. By default, it assumes the input
 * is an HTML fragment, wrapping it to make a complete HTML document, but the
 * second argument can be set to false to avoid wrapping. It returns null on
 * success, and, on failure, a string detailing all of the errors.
 *
 * @param {string} html
 * @param {boolean} [fragment]
 * @return {string|null}
 */
function lintHTML(html, fragment = true) {
    if (fragment) {
        html = `<!DOCTYPE html>
                <html>
                <head><title>test</title></head>
                <body>${html}</body>
                </html>`;
    }
    try {
        execSync(`java -jar ${vnu} --errors-only --format text -`, {
            input: html,
            stdio: 'pipe',
            timeout: 15000
        });
        return null;
    } catch (error) {
        const error_message = /** @type {Error} */ (error).message
            .split(os.EOL)
            .filter(line => line.startsWith('Error: '))
            .join(os.EOL);
        return error_message;
    }
}

// ### Exported public API
module.exports = {
    assert,
    itMacro,
    describeMacro,
    afterEachMacro,
    beforeEachMacro,
    lintHTML
};
