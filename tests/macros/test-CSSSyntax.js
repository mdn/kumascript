/* jshint node: true, mocha: true, esversion: 6 */

// Get necessary modules
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const { itMacro, describeMacro, beforeEachMacro } = require('./utils');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const FIXTURE_DIR = path.resolve(__dirname, 'fixtures', 'css-data');
const jsdom = require('jsdom');

const { JSDOM } = jsdom;

/** @type {Record<string,Record<string,string>>} */
const localStrings = require('../../macros/L10n-CSS.json');

// Set up Chai
chai.use(chaiAsPromised);

// Basic const
const CSS_BASE_SLUG = '/en-US/docs/Web/CSS';

const DATA = {
    properties: null,
    "at-rules": null,
    selectors: null,
    types: null,
    syntaxes: null,
    units: null,
};

for (const name in DATA) {
    const dataPath = path.resolve(FIXTURE_DIR, `${name}.json`);
    if (fs.existsSync(dataPath)) {
        DATA[name] = JSON.parse(fs.readFileSync(
            dataPath,
            'utf8'
        ));
    } else {
        DATA[name] = {};
    }
}

describeMacro("CSSSyntax", function() {
    beforeEachMacro(macro => {
        macro.ctx.mdn.fetchJSONResource = sinon.stub();
        macro.ctx.wiki.getPage = sinon.stub();

        Object.keys(DATA).forEach(key => {
            const dataURL = `https://raw.githubusercontent.com/mdn/data/master/css/${key}.json`;
            macro.ctx.mdn.fetchJSONResource.withArgs(dataURL).returns(DATA[key]);
        });
    });

    /*========*\
    |* @rules *|
    \*========*/

    itMacro('Correct result in preview mode', macro => {
        return macro.call().then(result => {
            const dom = JSDOM.fragment(result);
            chai.assert.equal(dom.textContent, localStrings.info_in_preview_not_available["en-US"]);
        });
    });

    itMacro('Correct result for existent @rule', macro => {
        return macro.call('@rule').then(result => {
            const dom = JSDOM.fragment(result);
            chai.assert.equal(dom.textContent, '@rule {\n  <group-rule-body>\n}');
        });
    });

    itMacro('Correct result for existent descriptor of existent @rule', macro => {
        return macro.call('descriptor', '@rule').then(result => {
            const dom = JSDOM.fragment(result);
            chai.assert.match(dom.textContent, /^<number>/);
        });
    });

    itMacro('Correct result for non-existent @rule', macro => {
        return macro.call('@invalid').then(result => {
            const dom = JSDOM.fragment(result);
            chai.assert.equal(dom.textContent, 'Syntax not found in DB!');
        });
    });

    itMacro('Correct result for non-existent descriptor of existent @rule', macro => {
        return macro.call('invalid', '@rule').then(result => {
            const dom = JSDOM.fragment(result);
            chai.assert.equal(dom.textContent, 'Syntax not found in DB!');
        });
    });

    itMacro('Correct result for non-existent descriptor of non-existent @rule', macro => {
        return macro.call('invalid', '@invalid').then(result => {
            const dom = JSDOM.fragment(result);
            chai.assert.equal(dom.textContent, 'Syntax not found in DB!');
        });
    });
});
