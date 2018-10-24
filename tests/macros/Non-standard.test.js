/**
 * Tests all Non-standard indicator macros
 *
 * @prettier
 */

// Get necessary modules
const { assert, describeMacro, itMacro } = require('./utils');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

/**
 * @param {string} result
 * @return {[string, DocumentFragment]}
 */
function testHeaderGeneric(result) {
    const dom = JSDOM.fragment(result);
    expect(dom.childElementCount).toBeGreaterThanOrEqual(1);
    assert(dom.firstElementChild.classList.contains("blockIndicator"),
        "Root element is a 'blockIndicator'");
    assert(dom.firstElementChild.classList.contains("nonStandard"),
        "Root element is 'nonStandard'");
    let header = dom.querySelector("strong");
    // Block indicator has a header
    expect(header).toEqual(expect.anything());
    assert.equal(header.textContent.trim(), "Non-standard");
    return [result, dom];
}

function testInline(result) {
    const dom = JSDOM.fragment(result);
    expect(dom.childElementCount).toBeGreaterThanOrEqual(1);
    assert(dom.firstElementChild.classList.contains("inlineIndicator"),
        "Root element is an 'inlineIndicator'");
    assert(dom.firstElementChild.classList.contains("nonStandard"),
        "Root element is 'nonStandard'");
    assert.equal(dom.textContent.trim(), "Non-standard");
}

describeMacro("Non-standardGeneric", function() {
    itMacro("Correct result for 'inline'", macro => {
        return macro.call('inline').then(testInline);
    });

    itMacro("Correct result for 'header'", macro => {
        return macro.call('header')
            .then(testHeaderGeneric)
            .then(([,dom]) => {
                // Non-standard Header doesn't contain the string 'Firefox OS'
                expect(dom.querySelector("p").textContent).not.toContain("Firefox OS");
            });
    });

    itMacro("Correct result for 'header' (Firefox OS)", macro => {
        macro.ctx.env.tags = ["Firefox OS"];
        return macro.call('header')
            .then(testHeaderGeneric)
            .then(([,dom]) => {
                // Non-standard Header contains the string 'Firefox OS'
                expect(dom.querySelector("p").textContent).toContain("Firefox OS");
            });
    });
});

describeMacro("Non-standard_Header", function() {
    itMacro("Correct result", macro => {
        return macro.call()
            .then(testHeaderGeneric)
            .then(([,dom]) => {
                // Non-standard Header doesn't contain the string 'Firefox OS'
                expect(dom.querySelector("p").textContent).not.toContain("Firefox OS");
            });
    });

    itMacro("Correct result (Firefox OS)", macro => {
        macro.ctx.env.tags = ["Firefox OS"];
        return macro.call()
            .then(testHeaderGeneric)
            .then(([,dom]) => {
                // Non-standard Header contains the string 'Firefox OS'
                expect(dom.querySelector("p").textContent).toContain("Firefox OS");
            });
    });
});
