/* jshint node: true, mocha: true, esversion: 6 */

const sinon = require('sinon'),
      utils = require('./utils'),
      chai = require('chai'),
      jsdom = require('jsdom'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro,
      beforeEachMacro = utils.beforeEachMacro;

const { JSDOM } = jsdom;

const locales = {
  'en-US': {
    'About_MDN': 'About MDN'
  },
  'fr': {
    'About_MDN': 'À propos'
  },  
}

function checkSidebarDom(dom, locale) {
  let section = dom.querySelector('section');
  assert(section.classList.contains('Quick_links'), 'Section does not contain Quick_links class');

  let links = dom.querySelectorAll('a');
  assert.equal(links[1].textContent,  locales[locale]['About_MDN']);
}

describeMacro('MDNSidebar', function () {

    itMacro('Creates a sidebar object for en-US', function (macro) {
        macro.ctx.env.locale = 'en-US';
        return macro.call().then(function(result) {
            let dom = JSDOM.fragment(result);
            checkSidebarDom(dom, 'en-US');
        });
    });

    itMacro('Creates a sidebar object for fr', function (macro) {
        macro.ctx.env.locale = 'fr';
        return macro.call().then(function(result) {
            let dom = JSDOM.fragment(result);
            checkSidebarDom(dom, 'fr');
        });
    });

});
