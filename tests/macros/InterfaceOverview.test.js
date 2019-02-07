/**
 * Test the API Interface Overview page content macro
 *
 * @prettier
 */

// Get necessary modules
const fs = require('fs');
const path = require('path');

const { assert, describeMacro, beforeEachMacro, itMacro } = require('./utils');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const INTERFACE_DATA = `[${JSON.stringify({
    XMLHttpRequestEventTarget: {
        inh: 'EventTarget',
        impl: []
    }
})}]`;

const DATA_DIR = path.resolve(__dirname, 'fixtures', 'interface-overview');
const DATA = ((...dataNames) => {
    /** @type {Record<string, object>} */
    let result = {};
    for (let i = 0; i < dataNames.length; i++) {
        const name = dataNames[i];
        result[name] = JSON.parse(
            fs.readFileSync(path.resolve(DATA_DIR, `${name}.json`))
        );
    }
    return result;
})('EventTarget', 'XMLHttpRequestEventTarget');

/**
 * @param {string[]} headers
 * @returns {(result: string) => void}
 */
function testInterface(headers) {
    return result => {
        const dom = JSDOM.fragment(result);
        expect(
            Array.from(dom.querySelectorAll('h2'), h =>
                h.textContent.trim()
            )
        ).toEqual(headers);
    }
}

describeMacro('InterfaceOverview', () => {
    beforeEachMacro(macro => {
        const realTemplate = macro.ctx.template;
        macro.ctx.template = jest.fn(async (name, args) => {
            switch (String(name).toLowerCase()) {
                case 'interfacedata':
                    return INTERFACE_DATA;
                default:
                    return realTemplate(name, args);
            }
        });
        macro.ctx.page.subpagesExpand = jest.fn(async (path, depth, self) => {
            let match = path && /\b[^/]+$/.exec(path);
            return match && DATA[match[0]];
        });
    });

    itMacro('No content in preview', async macro => {
        return assert.eventually.equal(macro.call(), '');
    });

    itMacro('Interface with Constructor (EventTarget)', async macro => {
        macro.ctx.env.slug = 'Web/API/EventTarget';
        return macro.call().then(testInterface(['Constructor', 'Properties', 'Methods']));
    });

    itMacro('Interface without Constructor (XMLHttpRequestEventTarget)', async macro => {
        macro.ctx.env.slug = 'Web/API/XMLHttpRequestEventTarget';
        return macro.call().then(testInterface(['Properties', 'Methods']));
    });
});
