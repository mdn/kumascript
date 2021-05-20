/**
 * Tests all Experimental indicator macros
 *
 * @prettier
 */

// Get necessary modules
const { assert, describeMacro, itMacro } = require('./utils');
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
        dom.firstElementChild.classList.contains('experimental'),
        "Root element is 'experimental'"
    );
    let header = dom.querySelector('strong');
    // Block indicator has a header
    expect(header).toEqual(expect.anything());
    assert.equal(
        header.textContent.trim(),
        'This is an experimental technology'
    );

    expect(
        dom.querySelector('.icon-only-inline, .inlineIndicator')
    ).not.toEqual(expect.anything());
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
        dom.firstElementChild.classList.contains('experimental'),
        "Root element is 'experimental'"
    );
    assert.equal(dom.textContent.trim(), 'Experimental');
    assert.equal(
        dom.firstElementChild.getAttribute('title'),
        'This is an experimental API that should not be used in production code.'
    );
}

/**
 * @param {string} result
 */
function testIcon(result) {
    const dom = JSDOM.fragment(result);
    expect(dom.childElementCount).toBeGreaterThanOrEqual(1);
    assert.equal(
        dom.firstElementChild.getAttribute('title'),
        'This is an experimental API that should not be used in production code.'
    );
    let icon = dom.querySelector('i.icon-beaker');
    expect(icon).toEqual(expect.anything());
}

describeMacro('SeeCompatTable', function() {
    itMacro('Correct result', macro => {
        return macro.call().then(testHeaderGeneric);
    });
});

describeMacro('ExperimentalBadge', function() {
    itMacro('Correct result', macro => {
        return macro.call().then(testInline);
    });

    itMacro('Correct result (icon)', macro => {
        return macro.call(true).then(testIcon);
    });
});

describeMacro('Experimental_Inline', function() {
    itMacro('Correct result', macro => {
        return macro.call().then(testIcon);
    });
});
