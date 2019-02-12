/**
 * @prettier
 */

// Get necessary modules
const fs = require('fs');
const path = require('path');

const { JSDOM } = require('jsdom');
const { assert, describeMacro, beforeEachMacro, itMacro } = require('./utils');

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'css-data');

/** @type {Record<string,Record<string,string>>} */
const localStrings = require('../../macros/L10n-CSS.json');

const DATA = {
    properties: null,
    'at-rules': null,
    selectors: null,
    types: null,
    syntaxes: null,
    units: null
};

for (const name in DATA) {
    const dataPath = path.resolve(FIXTURE_DIR, `${name}.json`);
    if (fs.existsSync(dataPath)) {
        DATA[name] = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } else {
        DATA[name] = {};
    }
}

describeMacro('CSSSyntax', function() {
    beforeEachMacro(macro => {
        const URLs = {};
        macro.ctx.mdn.fetchJSONResource = jest.fn(async url => {
            return url in URLs && DATA[URLs[url]];
        });
        macro.ctx.wiki.getPage = jest.fn(async _ => null);

        Object.keys(DATA).forEach(key => {
            const dataURL = `https://raw.githubusercontent.com/mdn/data/master/css/${key}.json`;
            URLs[dataURL] = key;
        });
    });

    /*========*\
    |* @rules *|
    \*========*/

    itMacro(
        'Correct result in preview mode', // Force line-break
        async macro => {
            const result = await macro.call();
            const dom = JSDOM.fragment(result);
            assert.equal(
                dom.textContent,
                localStrings.info_in_preview_not_available['en-US']
            );
        }
    );

    itMacro(
        'Correct result for existent @rule', // Force line-break
        async macro => {
            const result = await macro.call('@rule');
            const dom = JSDOM.fragment(result);
            assert.equal(dom.textContent, '@rule {\n  <group-rule-body>\n}');
        }
    );

    itMacro(
        'Correct result for existent descriptor of existent @rule',
        async macro => {
            const result = await macro.call('descriptor', '@rule');
            const dom = JSDOM.fragment(result);
            assert(dom.textContent.startsWith('<number>'));
        }
    );

    itMacro(
        'Correct result for non-existent @rule', // Force line-break
        async macro => {
            const result = await macro.call('@invalid');
            const dom = JSDOM.fragment(result);
            assert.equal(dom.textContent, 'Syntax not found in DB!');
        }
    );

    itMacro(
        'Correct result for non-existent descriptor of existent @rule',
        async macro => {
            const result = await macro.call('invalid', '@rule');
            const dom = JSDOM.fragment(result);
            assert.equal(dom.textContent, 'Syntax not found in DB!');
        }
    );

    itMacro(
        'Correct result for non-existent descriptor of non-existent @rule',
        async macro => {
            const result = await macro.call('invalid', '@invalid');
            const dom = JSDOM.fragment(result);
            assert.equal(dom.textContent, 'Syntax not found in DB!');
        }
    );

    itMacro(
        "Macro doesn't output unnecessary `<p>` and `<code>` tags inside `<pre>`",
        async macro => {
            const result = await macro.call(':is');
            const dom = JSDOM.fragment(result);

            assert.equal(dom.querySelector('p'), null);
            assert.equal(dom.querySelector('code'), null);
        }
    );
});
