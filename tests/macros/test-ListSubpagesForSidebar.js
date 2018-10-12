/* jshint node: true, mocha: true, esversion: 6 */

// Get necessary modules
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const { itMacro, describeMacro, beforeEachMacro } = require('./utils');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const fixture_dir = path.resolve(__dirname, 'fixtures');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// Let's add "eventually" to Chai so we can work with promises.
chai.use(chaiAsPromised);

// Load fixture data.
const FIXTURES = {
    exslt: {
        data: null,
        filename: 'subpagesExpand-Web-EXSLT-exsl.json',
        subpages: null,
        titles: [
            'exsl:node-set()',
            'exsl:object-type()',
        ],
        url: '/en-US/docs/Web/EXSLT/exsl',
    },
    http: {
        data: null,
        filename: 'subpagesExpand-depth-gt-1.json',
        subpages: null,
        titles: [
            'Choosing between www and non-www URLs',
            'Data URLs',
            'Evolution of HTTP',
            'Identifying resources on the Web',
            'MIME types',
        ],
        url: '/en-US/docs/Web/HTTP/Basics_of_HTTP',
    },
    xslt: {
        data: null,
        filename: 'subpagesExpand-Web-XSLT-Element.json',
        subpages: null,
        titles: [
            '<xsl:apply-imports>',
            '<xsl:apply-templates>',
            '<xsl:attribute-set>',
            '<xsl:attribute>',
            '<xsl:call-template>',
            '<xsl:choose>',
            '<xsl:comment>',
            '<xsl:copy-of>',
            '<xsl:copy>',
            '<xsl:decimal-format>',
            '<xsl:element>',
            '<xsl:fallback>',
            '<xsl:for-each>',
            '<xsl:if>',
            '<xsl:import>',
            '<xsl:include>',
            '<xsl:key>',
            '<xsl:message>',
            '<xsl:namespace-alias>',
            '<xsl:number>',
            '<xsl:otherwise>',
            '<xsl:output>',
            '<xsl:param>',
            '<xsl:preserve-space>',
            '<xsl:processing-instruction>',
            '<xsl:sort>',
            '<xsl:strip-space>',
            '<xsl:stylesheet>',
            '<xsl:template>',
            '<xsl:text>',
            '<xsl:transform>',
            '<xsl:value-of>',
            '<xsl:variable>',
            '<xsl:when>',
            '<xsl:with-param>',
        ],
        url: '/en-US/docs/Web/XSLT/Element',
    },
};
Object.keys(FIXTURES).forEach(key => {
    FIXTURES[key].data = JSON.parse(
        fs.readFileSync(
            path.resolve(fixture_dir, FIXTURES[key].filename),
            'utf8'
        )
    );
    if ('subpages' in FIXTURES[key]) {
        FIXTURES[key].subpages = FIXTURES[key].data.subpages || [];
    }
});

const base_url = 'https://developer.mozilla.org';

function getProps(items, prop_name) {
    var result = [];
    for (const item of items) {
        result.push(item[prop_name]);
    }
    return result;
}

describeMacro('ListSubpagesForSidebar', function () {
    beforeEachMacro((macro) => {
        // let's make sure we have clean calls to page.subpagesExpand
        macro.ctx.page.subpagesExpand = sinon.stub();

        Object.keys(FIXTURES).forEach(key => {
            const { url, subpages } = FIXTURES[key];
            macro.ctx.page.subpagesExpand.withArgs(url, -1, 0).returns(subpages);
        });
    });
    itMacro('One argument (url)', macro => macro.call(FIXTURES.http.url).then(result => {
        let dom = JSDOM.fragment(result);
        let fixture = FIXTURES.http;

        chai.assert.equal(dom.querySelectorAll('li').length, fixture.subpages.length,
            `Create ${fixture.subpages.length} <li> items`);
    }));
    itMacro("Angle brackets and namespace as delimiters ('<xsl:' and '>')", macro => macro.call(FIXTURES.xslt.url, 0, 0, '<xsl:', '>').then(result => {
        let dom = JSDOM.fragment(result);
        let fixture = FIXTURES.xslt;

        chai.assert.equal(dom.querySelectorAll('li').length, fixture.subpages.length,
            `Create ${fixture.subpages.length} <li> items`);
        chai.assert.sameMembers(Array.from(dom.querySelectorAll('li > a'), e => e.textContent), fixture.titles);
    }));
    itMacro("Function definition as delimiters ('exsl:' and '()')", macro => macro.call(FIXTURES.exslt.url, 0, 0, 'exsl:', '()').then(result => {
        let dom = JSDOM.fragment(result);
        let fixture = FIXTURES.exslt;

        chai.assert.equal(dom.querySelectorAll('li').length, fixture.subpages.length,
            `Create ${fixture.subpages.length} <li> items`);
        chai.assert.sameMembers(Array.from(dom.querySelectorAll('li > a'), e => e.textContent), fixture.titles);
    }));
});
