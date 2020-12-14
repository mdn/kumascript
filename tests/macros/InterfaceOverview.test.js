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

// Loaded in case a translation gets changed.
const L10N_COMMON = require('../../macros/L10n-Common.json');

const INTERFACE_DATA = JSON.stringify([
    {
        XMLHttpRequestEventTarget: {
            inh: 'EventTarget',
            impl: []
        }
    }
]);

/**
 * The preloaded `page.subpagesExpand()` results for pages
 * in the `Web/API` namespace.
 */
const API_PAGES = {
    EventTarget: null,
    GlobalEventHandlers: null,
    XMLHttpRequestEventTarget: null
};

// Preload `page.subpagesExpand()` results
for (const name in API_PAGES) {
    API_PAGES[name] = readJSONFixture('interface-overview', name);
}

/**
 * Checks that the DocumentFragment contains the supplied `<h2>` headings
 * at the top level (i.e. They're not nested inside an unclosed `<dl>` element)
 *
 * @param {DocumentFragment} dom
 * @param {string[]} headings
 */
function checkSectionTitles(dom, headings) {
    // An unclosed <dl> would just wrap all the remaining <h2>s,
    // which would no longer be directly accessible through
    // the `dom.children` property, as they’re no longer
    // direct descendants.
    let children = Array.from(dom.children).filter(n => n.matches('h2'));
    expect(children.map(h => h.textContent.trim())).toEqual(headings);
}

describeMacro('InterfaceOverview', () => {
    beforeEachMacro(macro => {
        macro.mockTemplate('InterfaceData', INTERFACE_DATA);
        macro.ctx.page.subpagesExpand = jest.fn(async (path, depth, self) => {
            let match = path && /\b[^/]+$/.exec(path);
            return match && API_PAGES[match[0]];
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

    itMacro('Mixin with Event Handlers (GlobalEventHandlers)', async macro => {
        macro.ctx.env.slug = 'Web/API/GlobalEventHandlers';
        return macro.call().then(result => {
            const dom = JSDOM.fragment(result);
            checkSectionTitles(dom, ['Properties', 'Methods']);
            expect(
                Array.from(dom.querySelectorAll('h3'), h =>
                    h.textContent.trim()
                )
            ).toContain(L10N_COMMON.Event_handlers['en-US']);
        });
    });

    itMacro('Unknown interface (Unknown)', async macro => {
        macro.ctx.env.slug = 'Web/API/Unknown';
        return macro.call().then(result => {
            const dom = JSDOM.fragment(result);
            checkSectionTitles(dom, ['Properties', 'Methods']);
        });
    });
});
