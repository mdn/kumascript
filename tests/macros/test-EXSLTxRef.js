/* jshint node: true, mocha: true, esversion: 6 */

// Get necessary modules
const sinon = require('sinon');
const { itMacro, describeMacro, beforeEachMacro } = require('./utils');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

// Set up Chai
chai.use(chaiAsPromised);

// Basic const
const EXSLT_BASE_SLUG = '/en-US/docs/Web/EXSLT';

// Template utils
function makeExpect (url, summary, label, clazz = null) {
    if (!summary)
        return `<a href="${url}"><code>${label}</code></a>`;

    summary = summary.replace(/<[^>]+>/g, '');

    if (clazz)
        return `<a href="${url}" class="${clazz}" title="${summary}"><code>${label}</code></a>`;

    return `<a href="${url}" title="${summary}"><code>${label}</code></a>`;
}


// Mock Pages
// ----------------------------------------------------------------------------
// Those mock pages are expected data return by a call to wiki.getPage
// The `url` is what should be passed to wiki.getPage
// The `data` is the object returned by wiki.getPage
// ----------------------------------------------------------------------------

const MOCK_PAGES = {
    'str_concat': {
        url : [EXSLT_BASE_SLUG, 'str', 'concat'].join('/'),
        data: {
            summary: "<code>str:concat()</code> returns a string containing all the string values in a node-set concatenated together.",
            tags: ["EXSLT", "Reference"]
        }
    }
};


// Test cases definition
// ----------------------------------------------------------------------------
// Each test case is define by:
// A `title` to make the test understandable by a human behing
// An `input` which is an Array of parameters that will be passed to the macro
// An `output` which is the string that the macro should return
//
// NOTE: we could probably make that more generic by having a single test
//       runner (see below) and a bunch of JSON files (one per macro) to
//       describe all the possible inputs and their expected outputs.
// ----------------------------------------------------------------------------

const TEST_CASE = [
    {
        title: 'One argument (function without brackets)',
        input: ['str:concat'],
        output: makeExpect(
            MOCK_PAGES.str_concat.url,
            MOCK_PAGES.str_concat.data.summary,
            'str:concat()'
        ),
    },
    {
        title: 'One argument (function with brackets)',
        input: ['str:concat()'],
        output: makeExpect(
            MOCK_PAGES.str_concat.url,
            MOCK_PAGES.str_concat.data.summary,
            'str:concat()'
        ),
    },
    {
        title: 'One argument (non-existent function)',
        input: ['invalid'],
        output: makeExpect(
            [EXSLT_BASE_SLUG, 'invalid'].join('/'),
            'The documentation about this has not yet been written; please consider contributing!',
            'invalid()',
            'new'
        ),
    },
    {
        title: 'Two arguments (Custom link text)',
        input: ['str:concat()', 'the concat() string function'],
        output: makeExpect(
            MOCK_PAGES.str_concat.url,
            MOCK_PAGES.str_concat.data.summary,
            'the concat() string function'
        ),
    }
];


// Test runner
// ----------------------------------------------------------------------------

describeMacro('EXSLTxRef', () => {
    beforeEachMacro((macro) => {
        // let's make sure we have a clean calls to wiki.getPage
        macro.ctx.wiki.getPage = sinon.stub();
        macro.ctx.wiki.pageExists = sinon.stub();

        Object.keys(MOCK_PAGES).forEach((key) => {
            const { url, data } = MOCK_PAGES[key];
            macro.ctx.wiki.getPage.withArgs(url).returns(data);
            macro.ctx.wiki.pageExists.withArgs(url).returns(true);
        });
        macro.ctx.wiki.pageExists.returns(false);
    });

    TEST_CASE.forEach((test) => {
        itMacro(test.title, (macro) => {
            return chai.assert.eventually.equal(
                macro.call(...test.input),
                test.output
            );
        });
    });
});
