/* jshint node: true, mocha: true, esversion: 6 */

// Get necessary modules
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const { itMacro, describeMacro, beforeEachMacro } = require('./utils');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// Set up Chai
chai.use(chaiAsPromised);

const GLOSSARY_SUBPAGES = JSON.parse(fs.readFileSync(path.resolve(__dirname, "fixtures", "GlossaryList-subpages.json")));

describeMacro("GlossaryList", () => {
    beforeEachMacro(macro => {
        macro.ctx.page.subpagesExpand = sinon.stub();
        macro.ctx.page.subpagesExpand.withArgs("/en-US/docs/Glossary", 2).returns(GLOSSARY_SUBPAGES);
        macro.ctx.page.subpagesExpand.returns([]);
    });

    itMacro("No arguments (en-US)", macro => {
        return macro.call().then(result => {
            let dom = JSDOM.fragment(result);
            let anchors = dom.querySelectorAll('a');
            chai.assert.lengthOf(anchors, GLOSSARY_SUBPAGES.length);
        });
    });

    itMacro("`defined` filter (en-US)", macro => {
        return macro.call({terms: ["AJAX", "Non-existent"], filter: "defined"}).then(result => {
            let dom = JSDOM.fragment(result);
            let anchors = dom.querySelectorAll('a');
            chai.assert.lengthOf(anchors, 1);
            let anchor = anchors[0];
            chai.assert.equal(anchor.href, "/en-US/docs/Glossary/AJAX");
            chai.assert.equal(anchor.title, "Asynchronous JavaScript And XML (AJAX) is a programming practice of building more complex, dynamic webpages using a technology known as XMLHttpRequest.");
        });
    });

    itMacro("`notdefined` filter (en-US)", macro => {
        return macro.call({terms: ["AJAX", "Non-existent"], filter: "notdefined"}).then(result => {
            let dom = JSDOM.fragment(result);
            let anchors = dom.querySelectorAll('a');
            chai.assert.lengthOf(anchors, 1);
            let anchor = anchors[0];
            chai.assert.equal(anchor.href, "/en-US/docs/Glossary/Non-existent");
            chai.assert.equal(anchor.title, "The definition of that term (Non-existent) has not been written yet; please consider contributing it!");
        });
    });
});

