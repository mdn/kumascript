/* jshint node: true, mocha: true, esversion: 6 */

const utils = require('./utils'),
      chai = require('chai'),
      jsdom = require('jsdom'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro;

const locales = {
  'en-US': {
    'Firefox_developer_release_notes': 'Firefox developer release notes'
  },
  'fr': {
    'Firefox_developer_release_notes': 'Notes de versions pour développeurs'
  }
};

function checkSidebarDom(dom, locale) {
  let section = dom.querySelector('section');
  assert(section.classList.contains('Quick_links'), 'Section does not contain Quick_links class');

  let links = dom.querySelectorAll('a');
  assert.equal(links[1].textContent,  locales[locale].Firefox_developer_release_notes);
}

describeMacro('FirefoxSidebar', function () {

    itMacro('Creates a sidebar object for en-US', function (macro) {
        macro.ctx.env.locale = 'en-US';
        return macro.call().then(function(result) {
            let dom = jsdom.JSDOM.fragment(result);
            checkSidebarDom(dom, 'en-US');
        });
    });

    itMacro('Creates a sidebar object for fr', function (macro) {
        macro.ctx.env.locale = 'fr';
        return macro.call().then(function(result) {
            let dom = jsdom.JSDOM.fragment(result);
            checkSidebarDom(dom, 'fr');
        });
    });

});
