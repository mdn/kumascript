/* jshint node: true, mocha: true, esversion: 6 */

// Get the modules we'll need

const fs = require("fs");
const path = require("path");
const chai = require("chai");
const sinon = require("sinon");
const chaiAsPromised = require("chai-as-promised");
const { itMacro, describeMacro, beforeEachMacro } = require('./utils');

// Set up chai for use with promises

chai.use(chaiAsPromised);

// Load up data macros we'll need

const jsonInterfaceData = require("../../macros/InterfaceData.json");
const jsonGroupData = require("../../macros/GroupData.json");
const jsonL10nCommon = require("../../macros/L10n-Common.json");

const macrosDir = path.resolve(__dirname, "../../macros")

// Basic constants

const API_BASE_SLUG = "docs/Web/API";
const WIKI_BASE_SLUG = "Web/API";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// Handle l10n mechanics
//
// @param key    The key of the string to localize
// @param locale The locale into which the key must be translated
// @return <string>
function _ (key, locale) {
    if (typeof key === 'object' && key !== null && !Array.isArray(key))
        return key[locale] || '';

    key = String(key);

    // Return the translation of strings found in L10n-Common
    if (key in L10N_COMMON)
        return L10N_COMMON[key][locale] || L10N_COMMON[key]['en-US'] || '';

    // Return an empty string if we found nothing
    return '';
}

// Build an absolute URL by concatenating the arguments.
function URL(...chunks) {
    return '/' + chunks.join('/');
}

// Turn a camelCase string into a snake_case string
//
// @param str     <string>  The string to transform
// @param upFirst <boolean> Indicate is the first letter must be upper cased (true by default)
// @return <string>
function camelToSnake (str, upFirst=true) {
    str = str.replace(/[A-Z]/g, (match) => "_" + match.toLowerCase());

    if (upFirst)
        str = str.replace(/^./, (match) => match.toUpperCase());

    return str;
}

// Load the specified macro file as text and return the string
//
// @param macrofilename
// @return <macrostring>
function fetchMacroString(macrofilename) {
    let filename = path.resolve(macrosDir, macrofilename);

    let macroText = fs.readFileSync(filename, "utf8");
    console.log(`Loaded macro file ${macrofilename}: ${macroText.substring(0, 80)}`)
    return macroText;
}

// =============================================================================
// MOCK DATA UTILITIES
// =============================================================================

// Extract the summary of a given page in a given locale if it exists
//
// @param key    <string>  The key of the page to retrieve
// @param locale <string>  The locale in which the summary must be provided
// @param clean  <boolean> Indicate if HTML tags must be striped (true by default)
// @return <string>
function getSummary(key, locale, clean=true) {
    if (!MOCK_PAGES[locale] ||
        !MOCK_PAGES[locale][key] ||
        !MOCK_PAGES[locale][key].data ||
        !MOCK_PAGES[locale][key].data.summary)
        return '';

    var str = MOCK_PAGES[locale][key].data.summary;

    if (clean)
        str = str.replace(/<[^>]+>/g, '');

    return str;
}

// =============================================================================
// MAKEEXPECT
//
// This function generates the expected output for a given input and locale.
// Update this code to produce the expected output.
// =============================================================================

function makeExpect(data, locale="en-US") {

}

// =============================================================================
// MOCK PAGES
//
// The mockPages object is a list of objects, each describing one fake MDN
// page. The information here is used to obtain the data that would be obtained
// by loading it from that page, or from the metadata for that page. There's one
// object here for each locale supported by the tests.
//
// url: A string providing the URL of the page, starting with /<locale>/
// data: An object providing data about the page, including:
//          summary: The page's summary text
//          tags: An array of the page's tags
// =============================================================================
const mockPages = {
    "en-US": {
        "Intersection Observer API": {
            url: ["/en-US", API_BASE_SLUG, "Intersection_Observer_API"].join("/"),
            data: {
                url: ["/en-US", API_BASE_SLUG, "Intersection_Observer_API"].join("/"),
                slug: [API_BASE_SLUG, "Intersection_Observer_API"].join("/"),
                summary: `The Intersection Observer API provides a way to asynchronously observe changes in the intersection of a target element with an ancestor element or with a top-level document's <a href="/en-US/docs/Glossary/viewport" class="glossaryLink" title="viewport: A viewport represents a polygonal (normally rectangular) area in computer graphics that is currently being viewed. In web browser terms, it refers to the part of the document you're viewing which is currently visible in its window (or the screen, if the document is being viewed in full screen mode). Content outside the viewport is not visible onscreen until scrolled into view.">viewport</a>.`,
                title: "Intersection Observer API",
//                translations: [],
                tags: ["API", "Reference", "IntersectionObserver", "Intersection Observer API", "Overview", "Web"]
            }
        },
        "IntersectionObserver": {
            url: ["/en-US", API_BASE_SLUG, "Intersection_Observer_API", "IntersectionObserver"].join("/"),
            data: {
                url: ["/en-US", API_BASE_SLUG, "Intersection_Observer_API/IntersectionObserver"].join("/"),
                slug: [API_BASE_SLUG, "Intersection_Observer_API/IntersectionObserver"].join("/"),
                summary: `The <code><strong>IntersectionObserver</strong></code> interface of the <a href="/en-US/docs/Web/API/Intersection_Observer_API">Intersection Observer API</a> provides a way to asynchronously observe changes in the intersection of a target element with an ancestor element or with a top-level document's <a href="/en-US/docs/Glossary/viewport" class="glossaryLink" title="viewport: A viewport represents a polygonal (normally rectangular) area in computer graphics that is currently being viewed. In web browser terms, it refers to the part of the document you're viewing which is currently visible in its window (or the screen, if the document is being viewed in full screen mode). Content outside the viewport is not visible onscreen until scrolled into view.">viewport</a>.`,
                title: "IntersectionObserver",
                tags: ["API", "Interface", "Reference", "Experimental", "IntersectionObserver", "Intersection Observer API"]
            }
        },
        "IntersectionObserverEntry": {
            url: ["/en-US", API_BASE_SLUG, "Intersection_Observer_API", "IntersectionObserverEntry"].join("/"),
            data: {
                url: ["/en-US", API_BASE_SLUG, "Intersection_Observer_API/IntersectionObserverEntry"].join("/"),
                slug: [API_BASE_SLUG, "Intersection_Observer_API/IntersectionObserverEntry"].join("/"),
                summary: `The <code><strong>IntersectionObserverEntry</strong></code> interface of the <a href="/en-US/docs/Web/API/Intersection_Observer_API">Intersection Observer API</a> describes the intersection between the target element and its root container at a specific moment of transition.`,
                title: "IntersectionObserverEntry",
                tags: ["API", "Interface", "Reference", "Experimental", "IntersectionObserverEntry", "Intersection Observer API", "Intersection Observer"]
            }
        },
        "Timing element visibility with the Intersection Observer API": {
            url: ["/en-US", API_BASE_SLUG, "Intersection_Observer_API", "Timing element visibility with the Intersection Observer API"].join("/"),
            data: {
                url: ["/en-US", API_BASE_SLUG, "Intersection_Observer_API", "Timing element visibility with the Intersection Observer API"].join("/"),
                slug: [API_BASE_SLUG, "Intersection_Observer_API", "Timing element visibility with the Intersection Observer API"].join("/"),
                summary: `In this article, we'll build a mock blog which has a number of ads interspersed among the contents of the page, then use the Intersection Observer API to track how much time each ad is visible to the user. When an ad exceeds one minute of visible time, it will be replaced with a new one.`,
                title: "pagename",
                tags: ["API", "Intersection Observer API", "Intersection Observer", "Example", "Tutorial", "Intermediate"]
            }
        }
    }
};

// =============================================================================
// MOCK PAGE TEMPLATE
//
// Copy this to get the basic framework for an entry in the mockPages list.
// =============================================================================
/*
        "pagename": {
            url: ["/en-US", API_BASE_SLUG, "pageleaf"].join("/"),
            data: {
                url: ["/en-US", API_BASE_SLUG, "pageleaf"].join("/"),
                slug: [API_BASE_SLUG, "pageleaf"].join("/"),
                summary: `summarytext`,
                title: "pagename",
                tags: []
            }
        }
*/

// =============================================================================
// TEST CASES
//
// The testCases array is a list of objects, each defining one test case. Each
// test case includes:
//
// title: A human-readable short description or name for the test
// input: An array of parameters to pass into the macro
// output: The string that the macro should return given these inputs
// env: An optional object containing values to add to or set in the environment
// =============================================================================
const testCases = [
    {
        title: "Correct output for APIRef on Intersection Observer API main page",
        input: ["Intersection Observer API"],
        env: {
            locale: "en-US",
            slug: [WIKI_BASE_SLUG, "Intersection_Observer_API"].join("/"),
        },
        output: `<section class="Quick_links" id="Quick_Links"><ol><li><strong><a href="/en-US/docs/Web/API/Intersection_Observer_API"><code>Intersection_Observer_API</a></code></strong></li></ol></section>`
    }
];

// =============================================================================
// TEST RUNNER
//
// This code runs the tests for the APIRef macro
// =============================================================================

describeMacro("APIRef", () => {
    // =========================================================================
    // Set up the environment for each macro test
    // =========================================================================

    beforeEachMacro((macro) => {
        macro.ctx.page.hasTag = sinon.stub();
        macro.ctx.page.subpagesExpand = sinon.stub();
        macro.ctx.template = sinon.stub();

        // Intercept calls to the template macro that are loading
        // GroupData.json

        macro.ctx.template.withArgs("template", ["GroupData"]).returns(jsonGroupData); //fetchMacroString("GroupData.json"));
        macro.ctx.template.withArgs("template", ["InterfaceData"]).returns(jsonInterfaceData); //fetchMacroString("InterfaceData.json"));
        macro.ctx.template.withArgs("template", ["L10n:Common"]).returns(jsonL10nCommon); //fetchMacroString("L10n-Common.json"));

        // Create fake functions for the stuff stubbed above

        Object.keys(mockPages["en-US"]).forEach((key) => {
            const {url, data} = mockPages["en-US"][key];

            // Set up handlers for the hasTag() method for each
            // of the values
            data.tags.forEach(tag => {
                macro.ctx.page.hasTag.withArgs(tag).returns(true);
                macro.ctx.page.hasTag.returns(false);
            });
        });
    });

    // =========================================================================
    // Generate and run each test case
    // =========================================================================

    testCases.forEach((test) => {
        itMacro(test.title, (macro) => {
            if (test.env) {
                Object.keys(test.env).forEach((key) => {
                    macro.ctx.env[key] = test.env[key];
                });
            }

            console.log(`Test case: ${test.input}`);
            return chai.assert.eventually.equal(
                macro.call(...test.input),
                test.output
            );
        });
    });
});
