/* jshint node: true, mocha: true, esversion: 6 */

const sinon = require('sinon'),
      utils = require('./utils'),
      chai = require('chai'),
      chaiAsPromised = require('chai-as-promised'),
      jsdom = require('jsdom'),
      extend = require('extend'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro,
      beforeEachMacro = utils.beforeEachMacro;

const { JSDOM } = jsdom;

// Let's add 'eventually' to assert so we can work with promises.
chai.use(chaiAsPromised);

describeMacro('FirefoxSidebar', function () {

    beforeEachMacro(function (macro) {
        macro.ctx.env.locale = 'en-US';
    });

    itMacro('Creates a sidebar object for en-US', function (macro) {
        return macro.call().then(function(result) {
            let dom = JSDOM.fragment(result);
            let links = dom.window.document.querySelector("a");
            assert.include(links.length, '5');
        });
    });
});
