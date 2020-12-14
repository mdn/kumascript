/**
 * @prettier
 */

// Provides utilities that as a whole constitute the macro test framework.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const vnu = require('vnu-jar');

const Environment = require('../../src/environment.js');
const Templates = require('../../src/templates.js');

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
 *           **Returns:**
 *           - `true` if a macro result has previously been
 *             mocked using `mockTemplate()`.
 *           - `false` otherwise.
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
 * @param {any} x The value.
 */
function assert(x) {
    expect(x).toBeTruthy();
}

/**
 * Asserts deep equality of actual and expected.
 *
 * @param {any} x Actual value.
 * @param {any} y Potential expected value.
 */
assert.equal = (x, y) => {
    expect(x).toEqual(y);
};

assert.eventually = {
    /**
     * Asserts deep equality of actual and expected.
     *
     * @template T Type of the resolved value.
     * @param {T|Promise<T>} x A promise which resolves to the actual value.
     * @param {any} y Potential expected value.
     */
    async equal(x, y) {
        expect(await x).toEqual(y);
    }
};

/**
 * Asserts that list includes the supplied element.
 *
 * @param {string|any[]} list Container string or array.
 * @param {string|any} element Potential value contained in the list.
 */
assert.include = (list, element) => {
    expect(list).toContain(element);
};

/**
 * Asserts that value is true.
 *
 * @param {boolean} value Actual value.
 */
assert.isTrue = value => {
    expect(value).toEqual(true);
};

/**
 * Asserts that value is false.
 *
 * @param {boolean} value Actual value.
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
 * @param {any} value Actual value.
 */
assert.isArray = value => {
    expect(value).toBeInstanceOf(Array);
};

/**
 * Asserts that value is an object of type 'Object'
 * (as revealed by Object.prototype.toString).
 *
 * @param {any} value Actual value.
 * @remarks The assertion does match subclassed objects.
 */
assert.isObject = value => {
    expect(value).toBeInstanceOf(Object);
};

/**
 * Asserts that value is a function.
 *
 * @param {any} value Actual value.
 */
assert.isFunction = value => {
    expect(value).toBeInstanceOf(Function);
};

/**
 * Asserts that object has a property named by property.
 *
 * @param {object} value Container object.
 * @param {string} prop Potential contained property of object.
 */
assert.property = (value, prop) => {
    expect(value).toHaveProperty(prop);
};

/**
 * Asserts that object doesn't have a property named by property.
 *
 * @param {object} value Container object.
 * @param {string} prop Potential contained property of object.
 */
assert.notProperty = (value, prop) => {
    expect(value).not.toHaveProperty(prop);
};

/**
 * Asserts that set1 and set2 have the same members. Order is not take into account.
 *
 * @param {Iterable} a1 Actual set of values.
 * @param {Iterable} a2 Potential expected set of values.
 */
assert.sameMembers = (a1, a2) => {
    expect(new Set(a1)).toEqual(new Set(a2));
};

/**
 * @param {string} macroName
 * @return {Macro}
 */
function createMacroTestObject(macroName) {
    /**
     * @param {string} name
     * @return {string}
     */
    function normalizeMacroName(name) {
        return typeof name === 'string'
            ? name.replace(/:/g, '-').toLowerCase()
            : name;
    }

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
        let macroName = normalizeMacroName(name)
        let result = macroResults.get(macroName);
        if (typeof result === 'string') {
            return result;
        }
        return realTemplate(name, ...args);
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
         * When writing tests for a macro that invokes other macros with
         * the `template()` function, you sometimes want to specify
         * a mock return value for those other macros.
         *
         * This function provides a much easier way to handle that than
         * using `jest.fn()` directly.
         *
         * To unmock a template result, simply call `unmockTemplate()`
         * with the same `name`.
         *
         * @param {string} name
         * @param {string} result
         */
        mockTemplate(name, result) {
            macroResults.set(
                normalizeMacroName(name),
                String(result)
            );
        },

        /**
         * Stops mocking the result of a `template()` function call.
         *
         * @param {string} name
         * @returns {boolean}
         *          - `true` if a macro result has previously been
         *            mocked using `mockTemplate()`.
         *          - `false` otherwise.
         */
        unmockTemplate(name) {
            return macroResults.delete(normalizeMacroName(name));
        },

        /**
         * Use this function to make test calls on the named macro, if
         * applicable.  Its arguments become the arguments to the
         * macro. It returns a promise.
         *
         * @param {...any} args
         * @returns {Promise<string>}
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
 * @callback MacroTestFunction
 *
 * @param {Macro} macro The macro test object.
 * @return {void|Promise<void>}
 */

/**
 * This is the essential function for testing macros. Use it as
 * you would use mocha's "describe", with the exception that the
 * first argument must be the name of the macro being tested.
 *
 * @param {string} macroName
 * @param {() => void} runTests
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
 * @param {MacroTestFunction} runTest
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
 * @param {MacroTestFunction} setup
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
 * @param {MacroTestFunction} teardown
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
 * @param {boolean} [fragment] Whether the HTML is a fragment or not.
 * @return {string|null} The error message, or `null` if the HTML snippet is valid.
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
        /**
         * Without `JSON.stringify(…)`, spaces in the file path would be treated
         * as argument separators, e.g.:
         * `C:\Mozilla Sources\kumascript\node_modules\...\vnu-jar\...\vnu.jar`
         * would be interpreted as:
         *
         * - Argument 1: `C:\Mozilla`
         * - Argument 2: `Sources\kumascript\node_modules\...\vnu-jar\...\vnu.jar`
         */
        execSync(`java -jar ${JSON.stringify(vnu)} --errors-only --format text -`, {
            input: html,
            stdio: 'pipe',
            timeout: 15000
        });
        return null;
    } catch (error) {
        const error_message = error.message
            // `vnu` always uses `\n`, even on Windows.
            .split(/\r?\n/g)
            .filter(line => /^\s*Error: /.test(line))
            .join(os.EOL);
        if (!error_message) {
            // In case `vnu` fails due to other reasons.
            throw error;
        }
        return error_message;
    }
}

/**
 * Reads a generic fixture file from the `fixtures` directory.
 *
 * @param {string|string[]} filePath
 *        A path to a file relative to the `fixtures` directory.
 * @param {string|null} [encoding]
 *        The file encoding. Set to `null` to load the file as a binary `Buffer`.
 *
 * @returns {string}
 */
function readFixture(filePath, encoding = 'utf-8') {
    if (!Array.isArray(filePath)) {
        filePath = [filePath];
    }
    let absolutePath = path.resolve(__dirname, 'fixtures', ...filePath);
    return fs.readFileSync(absolutePath, typeof encoding === 'string' ? encoding : undefined);
}

/**
 * Reads a JSON fixture file from the `fixtures` directory.
 *
 * @template T The schema of the JSON payload.
 * @param {...string} filePath
 *        A path to a file relative to the `fixtures` directory.
 *
 *        The `.json` file extension can be omitted.
 *
 * @returns {T} The parsed JSON payload.
 *
 * @throws {SyntaxError} If the JSON file contains a syntax error.
 */
function readJSONFixture(...filePath) {
    let fileName = filePath.pop();
    if (!path.extname(fileName)) {
        fileName += '.json';
    }
    filePath.push(fileName)
    return JSON.parse(readFixture(filePath));
}

// ### Exported public API
module.exports = {
    assert,
    itMacro,
    describeMacro,
    afterEachMacro,
    beforeEachMacro,
    lintHTML,
    readFixture,
    readJSONFixture
};
