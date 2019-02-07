/**
 * Test the API Interface Overview page content macro
 *
 * @prettier
 */

// Get necessary modules
const {
    assert,
    describeMacro,
    beforeEachMacro,
    itMacro,
    readJSONFixture
} = require('./utils');
const { JSDOM } = require('jsdom');

const INTERFACE_DATA = JSON.stringify([
    {
        XMLHttpRequestEventTarget: {
            inh: 'EventTarget',
            impl: []
        }
    }
]);

const DATA = ((...dataNames) => {
    /** @type {Record<string, any>} */
    let result = {};
    for (const name of dataNames) {
        result[name] = readJSONFixture('interface-overview', name);
    }
    return result;
})('EventTarget', 'XMLHttpRequestEventTarget');

/**
 * @param {DocumentFragment} dom
 * @param {string[]} headers
 */
function checkSectionTitles(dom, headers) {
    // An unclosed <dl> would just wrap all the remaining <h2>s,
    // which would no longer be directly accessible through
    // the `dom.children` property, as they’re no longer
    // direct descendants.
    let children = Array.from(dom.children).filter(n => n.matches('h2'));
    expect(children.map(h => h.textContent.trim())).toEqual(headers);
}

describeMacro('InterfaceOverview', () => {
    beforeEachMacro(macro => {
        macro.mockTemplate('GroupData', INTERFACE_DATA);
        macro.ctx.page.subpagesExpand = jest.fn(async (path, depth, self) => {
            let match = path && /\b[^/]+$/.exec(path);
            return match && DATA[match[0]];
        });
    });

    itMacro('Test preview mode display (no param, no slug)', async macro => {
        return assert.eventually.equal(macro.call(), '');
    });

    itMacro('Interface with Constructor (EventTarget)', async macro => {
        macro.ctx.env.slug = 'Web/API/EventTarget';
        return macro.call().then(result => {
            const dom = JSDOM.fragment(result);
            checkSectionTitles(dom, ['Constructor', 'Properties', 'Methods']);
        });
    });

    itMacro(
        'Interface without Constructor (XMLHttpRequestEventTarget)',
        async macro => {
            macro.ctx.env.slug = 'Web/API/XMLHttpRequestEventTarget';
            return macro.call().then(result => {
                const dom = JSDOM.fragment(result);
                checkSectionTitles(dom, ['Properties', 'Methods']);
            });
        }
    );

    itMacro('Unknown interface (Unknown)', async macro => {
        macro.ctx.env.slug = 'Web/API/Unknown';
        return macro.call().then(result => {
            const dom = JSDOM.fragment(result);
            checkSectionTitles(dom, ['Properties', 'Methods']);
        });
    });
});
