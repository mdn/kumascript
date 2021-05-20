/**
 * Tests all Deprecated indicator macros
 *
 * @prettier
 */

// Get necessary modules
const { assert, itMacro, describeMacro } = require('./utils');
const { JSDOM } = require('jsdom');

/**
 * @param {string} result
 */
function testHeaderGeneric(result) {
    const dom = JSDOM.fragment(result);
    expect(dom.childElementCount).toBeGreaterThanOrEqual(1);
    assert(
        dom.firstElementChild.classList.contains('blockIndicator'),
        "Root element is a 'blockIndicator'"
    );
    assert(
        dom.firstElementChild.classList.contains('deprecated'),
        "Root element is 'deprecated'"
    );
    let header = dom.querySelector('strong');
    // Block indicator has a header
    expect(header).toEqual(expect.anything());
    assert.equal(header.textContent.trim(), 'Deprecated');
}

/**
 * @param {string} result
 */
function testInline(result) {
    const dom = JSDOM.fragment(result);
    expect(dom.childElementCount).toBeGreaterThanOrEqual(1);
    assert(
        dom.firstElementChild.classList.contains('inlineIndicator'),
        "Root element is an 'inlineIndicator'"
    );
    assert(
        dom.firstElementChild.classList.contains('deprecated'),
        "Root element is 'deprecated'"
    );
    assert.equal(dom.textContent.trim(), 'Deprecated');
    assert.equal(
        dom.firstElementChild.getAttribute('title'),
        'This deprecated API should no longer be used, but will probably still work.'
    );
}

/**
 * @param {string} text
 * @param {string} [title]
 * @return {(result: string) => void}
 */
function testInlineVersioned(text, title = null) {
    return result => {
        const dom = JSDOM.fragment(result);
        expect(dom.childElementCount).toBeGreaterThanOrEqual(1);
        assert(
            dom.firstElementChild.classList.contains('inlineIndicator'),
            "Root element is an 'inlineIndicator'"
        );
        assert(
            dom.firstElementChild.classList.contains('deprecated'),
            "Root element is 'deprecated'"
        );
        assert.equal(dom.textContent.trim(), text);
        if (title) {
            assert.equal(dom.firstElementChild.getAttribute('title'), title);
        }
    };
}

/**
 * @param {string} result
 */
function testIcon(result) {
    const dom = JSDOM.fragment(result);
    expect(dom.childElementCount).toBeGreaterThanOrEqual(1);
    assert.equal(
        dom.firstElementChild.getAttribute('title'),
        'This deprecated API should no longer be used, but will probably still work.'
    );
    let icon = dom.querySelector('i.icon-thumbs-down-alt');
    expect(icon).toEqual(expect.anything());
}

describeMacro('DeprecatedGeneric', function() {
    itMacro("Correct result for 'inline'", macro => {
        return macro.call('inline').then(testInline);
    });

    itMacro("Correct result for 'header'", macro => {
        return macro.call('header').then(testHeaderGeneric);
    });
});

describeMacro('Deprecated_Header', function() {
    itMacro('Correct result', macro => {
        return macro.call().then(testHeaderGeneric);
    });
});

describeMacro('DeprecatedBadge', function() {
    itMacro('Correct result', macro => {
        return macro.call().then(testInline);
    });

    itMacro('Correct result (icon)', macro => {
        return macro.call(true).then(testIcon);
    });
});

describeMacro('Deprecated_Inline', function() {
    itMacro('No arguments (en-US)', function(macro) {
        return macro.call().then(testIcon);
    });

    itMacro("'semver' string only (en-US)", function(macro) {
        return macro
            .call('1.9.2')
            .then(
                testInlineVersioned(
                    'Deprecated since Gecko 1.9.2',
                    '(Firefox 3.6 / Thunderbird 3.1 / Fennec 1.0)'
                )
            );
    });

    itMacro('Numeric version only (en-US)', function(macro) {
        return macro
            .call(45)
            .then(
                testInlineVersioned(
                    'Deprecated since Gecko 45',
                    '(Firefox 45 / Thunderbird 45 / SeaMonkey 2.42)'
                )
            );
    });

    itMacro('Gecko-prefixed version (en-US)', function(macro) {
        return macro
            .call('gecko45')
            .then(
                testInlineVersioned(
                    'Deprecated since Gecko 45',
                    '(Firefox 45 / Thunderbird 45 / SeaMonkey 2.42)'
                )
            );
    });

    itMacro('HTML-prefixed version (en-US)', function(macro) {
        return macro
            .call('html4')
            .then(testInlineVersioned('Deprecated since HTML4'));
    });

    itMacro('JS-prefixed version (en-US)', function(macro) {
        return macro
            .call('js1.7')
            .then(testInlineVersioned('Deprecated since JavaScript 1.7'));
    });

    itMacro('CSS-prefixed version (en-US)', function(macro) {
        return macro
            .call('css2')
            .then(testInlineVersioned('Deprecated since CSS 2'));
    });

    itMacro('CSS-prefixed version (ja)', function(macro) {
        macro.ctx.env.locale = 'ja';
        return macro.call('css2').then(testInlineVersioned('非推奨 CSS 2'));
    });

    itMacro('Nonsense-prefixed version (en-US)', function(macro) {
        return macro.call('foobar13').then(testInline);
    });
});
