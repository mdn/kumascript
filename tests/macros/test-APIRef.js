/* jshint node: true, mocha: true, esversion: 6 */

const utils = require('./utils'),
      sinon = require('sinon'),
      chai = require('chai'),
      chaiAsPromised = require('chai-as-promised'),
      jsdom = require('jsdom'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro,
      beforeEachMacro = utils.beforeEachMacro;

chai.use(chaiAsPromised);

// Data for generating mock responses from page.subpagesExpand()

const MOCK_SUBPAGES = [
    {
        locale: "en-US",
        url: "/en-US/docs/Web/API/Intersection_Observer_API/Timing_element_visibility",
        subpages: [ ],
        slug: "Web/API/Intersection_Observer_API/Timing_element_visibility",
        title: "Timing element visibility with the Intersection Observer API",
        summary: "In this article, we'll build a mock blog which has a number of ads interspersed among the contents of the page, then use the Intersection Observer API to track how much time each ad is visible to the user. When an ad exceeds one minute of visible time, it will be replaced with a new one",
        tags: [ "API", "Example", "Tutorial", "Intermediate", "Intersection Observer", "Intersection Observer API" ]
    }
];

// The expected quicklinks HTML we should generate for Intersection Observer API

const basicExpected = `\
  <div class="quick-links" id="quick-links">
    <div class="quick-links-head">Related Topics</div>
    <ol><li><strong><a href="/en-US/docs/Web/API/Intersection_Observer_API">Intersection Observer API</a></strong></li><li class="toggle"><details open><summary>Guides</summary><ol><li><a href="/en-US/docs/Web/API/Intersection_Observer_API/Timing_element_visibility" title="In this article, we'll build a mock blog which has a number of ads interspersed among the contents of the page, then use the Intersection Observer API to track how much time each ad is visible to the user. When an ad exceeds one minute of visible time, it will be replaced with a new one.">Timing element visibility with the Intersection Observer API</a></li></ol></details></li><li class="toggle"><details open><summary>Interfaces</summary><ol><li><a rel="nofollow" href="/en-US/docs/Web/API/IntersectionObserver"><code>IntersectionObserver</code></a></li><li><a rel="nofollow" href="/en-US/docs/Web/API/IntersectionObserverEntry"><code>IntersectionObserverEntry</code></a></li></ol></details></li></ol>
  </div>`;

describeMacro("APIRef", function() {
    beforeEachMacro(function(macro) {
        macro.ctx.template = sinon.stub();
        macro.ctx.template.withArgs("subpagesExpand", [MOCK_SUBPAGES[0].url]).returns(MOCK_SUBPAGES);
    });

    itMacro("Generates normal sidebar (Intersection Observer API)", function(macro) {
        return assert.eventually.equal(macro.call("Intersection Observer API"), basicExpected);
    });
});
