/**
 * @prettier
 */

const { assert, itMacro, describeMacro } = require('./utils');

const js_ref_slug = 'Web/JavaScript/Reference/';
const js_ref_url = '/en-US/docs/' + js_ref_slug;

describeMacro('jsxref', function() {
    itMacro('One argument (simple global object)', function(macro) {
        // Suggested in macro docstring, used on:
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTime
        var name = 'Date',
            partial_slug = 'Date',
            ref_url = js_ref_url + partial_slug,
            glob_url = js_ref_url + 'Global_Objects/' + partial_slug,
            title =
                'Creates a JavaScript Date instance that represents a' +
                ' single moment in time. Date objects are based on a' +
                ' time value that is the number of milliseconds since' +
                ' 1 January, 1970 UTC.',
            expected =
                '<a href="' +
                glob_url +
                '" title="' +
                title +
                '">' +
                '<code>' +
                name +
                '</code></a>';

        macro.ctx.wiki.getPage = jest.fn(async url => {
            if (url === glob_url) {
                return {
                    slug: js_ref_slug + partial_slug,
                    summary: title
                };
            } else if (url === ref_url) {
                return {};
            }
        });

        return assert.eventually.equal(macro.call(name), expected);
    });

    itMacro('One argument (method by title)', function(macro) {
        // Used on:
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse
        var name = 'Array.prototype.join()',
            partial_slug = 'Array/join',
            ref_url = js_ref_url + partial_slug,
            glob_url = js_ref_url + 'Global_Objects/' + partial_slug,
            title =
                'The join() method joins all elements of an array (or' +
                ' an array-like object) into a string and returns this' +
                ' string.',
            expected =
                '<a href="' +
                glob_url +
                '" title="' +
                title +
                '">' +
                '<code>' +
                name +
                '</code></a>';

        macro.ctx.wiki.getPage = jest.fn(async url => {
            if (url === glob_url) {
                return {
                    slug: js_ref_slug + partial_slug,
                    summary: title
                };
            } else if (url === ref_url) {
                return {};
            }
        });

        return assert.eventually.equal(macro.call(name), expected);
    });

    itMacro('Two arguments (method by slug, display name)', function(macro) {
        // Used on:
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function
        // {{jsxref("Statements/function", "function statement")}}
        var name = 'function statement',
            partial_slug = 'Statements/function',
            ref_url = js_ref_url + partial_slug,
            glob_url = js_ref_url + 'Global_Objects/' + partial_slug,
            title =
                'The function declaration defines a function with the' +
                ' specified parameters.',
            expected =
                '<a href="' +
                glob_url +
                '" title="' +
                title +
                '">' +
                '<code>' +
                name +
                '</code></a>';

        macro.ctx.wiki.getPage = jest.fn(async url => {
            if (url === glob_url) {
                return {
                    slug: js_ref_slug + partial_slug,
                    summary: title
                };
            } else if (url === ref_url) {
                return {};
            }
        });

        return assert.eventually.equal(
            macro.call(partial_slug, name),
            expected
        );
    });

    itMacro('Two arguments (non-global by slug, name)', function(macro) {
        // Used on:
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators
        // {{jsxref("Operators/yield", "yield")}}
        var name = 'yield',
            partial_slug = 'Operators/yield',
            ref_url = js_ref_url + partial_slug,
            glob_url = js_ref_url + 'Global_Objects/' + partial_slug,
            title =
                'The yield keyword is used to pause and resume a' +
                ' generator function (function* or legacy generator' +
                ' function).',
            expected =
                '<a href="' +
                ref_url +
                '" title="' +
                title +
                '">' +
                '<code>' +
                name +
                '</code></a>';

        macro.ctx.wiki.getPage = jest.fn(async url => {
            if (url === ref_url) {
                return {
                    slug: js_ref_slug + partial_slug,
                    summary: title
                };
            } else if (url === glob_url) {
                return {};
            }
        });

        return assert.eventually.equal(
            macro.call(partial_slug, name),
            expected
        );
    });

    itMacro('Three arguments (slug, name, #anchor)', function(macro) {
        // Used on:
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of
        // {{jsxref("Statements/for...in", "array iteration and for...in", "#Array_iteration_and_for...in")}}
        var name = 'array iteration and for...in',
            partial_slug = 'Statements/for...in',
            anchor = '#Array_iteration_and_for...in',
            ref_url = js_ref_url + partial_slug,
            glob_url = js_ref_url + 'Global_Objects/' + partial_slug,
            title =
                'The for...in statement iterates over the enumerable' +
                ' properties of an object. For each distinct property,' +
                ' statements can be executed.',
            expected =
                '<a href="' +
                glob_url +
                anchor +
                '" title="' +
                title +
                '">' +
                '<code>' +
                name +
                '</code></a>';

        macro.ctx.wiki.getPage = jest.fn(async url => {
            if (url === glob_url) {
                return {
                    slug: js_ref_slug + partial_slug,
                    summary: title
                };
            } else if (url === ref_url) {
                return {};
            }
        });

        return assert.eventually.equal(
            macro.call(partial_slug, name, anchor),
            expected
        );
    });

    itMacro('Three arguments (slug, name, anchor without hash) [ru]', function(
        macro
    ) {
        // When the # is omitted in the anchor, it is automatically added
        // Used on:
        // https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Array/prototype
        // {{jsxref("Global_Objects/Array", "Array", "массива")}}
        var name = 'Array',
            partial_slug = 'Global_Objects/Array',
            anchor = 'массива',
            js_ref_ru_url = '/ru/docs/' + js_ref_slug,
            ref_url = js_ref_ru_url + partial_slug,
            glob_url = js_ref_ru_url + 'Global_Objects/' + partial_slug,
            title =
                'Массив (Array) в JavaScript является глобальным' +
                ' объектом, который используется в создании массивов;' +
                ' которые представляют собой спископодобные объекты' +
                ' высокого уровня.',
            expected =
                '<a href="' +
                glob_url +
                '#' +
                anchor +
                '" title="' +
                title +
                '">' +
                '<code>' +
                name +
                '</code></a>';

        macro.ctx.env.locale = 'ru';

        macro.ctx.wiki.getPage = jest.fn(async url => {
            if (url === glob_url) {
                return {
                    slug: js_ref_slug + partial_slug,
                    summary: title
                };
            } else if (url === ref_url) {
                return {};
            }
        });

        return assert.eventually.equal(
            macro.call(partial_slug, name, anchor),
            expected
        );
    });

    itMacro(
        'Four arguments (slug, name, empty anchor, omit code wrap)',
        function(macro) {
            // Used on:
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
            // {{jsxref("Operators/function", "function expressions", "", 1)}}
            var name = 'function expressions',
                partial_slug = 'Operators/function',
                ref_url = js_ref_url + partial_slug,
                glob_url = js_ref_url + 'Global_Objects/' + partial_slug,
                title =
                    'The function keyword can be used to define a function' +
                    ' inside an expression.',
                expected =
                    '<a href="' +
                    ref_url +
                    '" title="' +
                    title +
                    '">' +
                    name +
                    '</a>';

            macro.ctx.wiki.getPage = jest.fn(async url => {
                if (url === ref_url) {
                    return {
                        slug: js_ref_slug + partial_slug,
                        summary: title
                    };
                } else if (url === glob_url) {
                    return {};
                }
            });

            return assert.eventually.equal(
                macro.call(partial_slug, name, '', 1),
                expected
            );
        }
    );

    itMacro('Quotes in summary are escaped', function(macro) {
        // Double-quotes are replaced with &quot;. Used on:
        // https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/38
        // {{jsxref("Function/name", "name")}}
        var name = 'name',
            partial_slug = 'Function/name',
            ref_url = js_ref_url + partial_slug,
            glob_url = js_ref_url + 'Global_Objects/' + partial_slug,
            title =
                "A Function object's read-only name property indicates" +
                " the function's name as specified when it was created," +
                ' or "anonymous" for functions created anonymously.',
            escaped_title =
                "A Function object's read-only name property indicates" +
                " the function's name as specified when it was created," +
                ' or &quot;anonymous&quot; for functions created' +
                ' anonymously.',
            expected =
                '<a href="' +
                glob_url +
                '" title="' +
                escaped_title +
                '">' +
                '<code>' +
                name +
                '</code></a>';

        macro.ctx.wiki.getPage = jest.fn(async url => {
            if (url === glob_url) {
                return {
                    slug: js_ref_slug + partial_slug,
                    summary: title
                };
            } else if (url === ref_url) {
                return {};
            }
        });

        return assert.eventually.equal(
            macro.call(partial_slug, name),
            expected
        );
    });

    itMacro('Standard title is used on missing document', function(macro) {
        // Common on newly translated pages, such as
        // https://developer.mozilla.org/pt-BR/docs/Web/JavaScript/Reference/Global_Objects/String/replace
        // {{jsxref("RegExp.prototype.test()")}}
        var name = 'RegExp.prototype.test()',
            partial_slug = 'RegExp/test',
            glob_url = js_ref_url + 'Global_Objects/' + partial_slug,
            standard =
                'The documentation about this has not yet been' +
                ' written; please consider contributing!',
            expected =
                '<a href="' +
                glob_url +
                '" title="' +
                standard +
                '">' +
                '<code>' +
                name +
                '</code></a>';

        macro.ctx.wiki.getPage = jest.fn(async url => ({}));

        return assert.eventually.equal(macro.call(name), expected);
    });
});
