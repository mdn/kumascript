/* jshint node: true, mocha: true, esversion: 6 */

// Get necessary modules
const sinon = require('sinon');
const { itMacro, describeMacro, beforeEachMacro } = require('./utils');
const chai = require('chai');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const SUBNAV = `
<ol>
    <li><strong><a href="/en-US/docs/Sandbox">Sandbox</a></strong>
    <li><strong>Subpages:</strong>
        <ol>
            <li><a href="/en-US/docs/Sandbox/Test">Test</a></li>
        </ol>
    </li>
</ol>`;

describeMacro("IncludeSubnav", () => {
    beforeEachMacro(macro => {
        macro.ctx.wiki.page = sinon.stub();
    });

    itMacro("Legacy subnav", macro => {
        macro.ctx.wiki.page.returns(SUBNAV);
        return macro.call("/en-US/docs/Sandbox").then(result => {
            let dom = JSDOM.fragment(result);
            chai.assert.equal(dom.childElementCount, 2);

            let heading = dom.firstElementChild;
            chai.assert.equal(heading.id, "Subnav");
            chai.assert.equal(heading.textContent.trim(), "Subnav");

            let list = dom.lastElementChild;
            chai.assert.equal(list.nodeName, "OL");
        });
    });

    itMacro("Modern quick links", macro => {
        macro.ctx.wiki.page.returns(`<section id="Quick_Links">${SUBNAV}</section>`);
        return macro.call("/en-US/docs/Sandbox").then(result => {
            let dom = JSDOM.fragment(result);
            chai.assert.equal(dom.childElementCount, 1);

            let section = dom.firstElementChild;
            chai.assert.equal(section.nodeName, "SECTION");
            chai.assert.equal(section.id, "Quick_Links");

            let list = section.firstElementChild;
            chai.assert.equal(list.nodeName, "OL");
        });
    });
});
