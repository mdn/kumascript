/* jshint node: true, mocha: true, esversion: 6 */

const fs = require('fs'),
      path = require('path'),
      sinon = require('sinon'),
      utils = require('./utils'),
      chai = require('chai'),
      chaiAsPromised = require('chai-as-promised'),
      jsdom = require("jsdom"),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro,
      beforeEachMacro = utils.beforeEachMacro,
      fixture_dir = path.resolve(__dirname, 'fixtures/compat');

const { JSDOM } = jsdom;

// Let's add "eventually" to assert so we can work with promises.
chai.use(chaiAsPromised);

let fixtureCompatData = {};
fs.readdirSync(fixture_dir).forEach(function(fn) {
    Object.assign(fixtureCompatData, JSON.parse(
        fs.readFileSync(path.resolve(fixture_dir, fn), 'utf8')
    ));
});

describeMacro('Compat', function () {

    beforeEachMacro(function (macro) {
        macro.ctx.require = sinon.stub();
        macro.ctx.require.withArgs('mdn-browser-compat-data').returns(fixtureCompatData);
    });

    itMacro('Outputs a message if there is no data for the query "foo.bar"', function (macro) {
        let actual = macro.call('foo.bar');
        let expected = 'No compatibility data found. Please contribute data for "foo.bar" (depth: 1) to the <a href="https://github.com/mdn/browser-compat-data">MDN compatibility data repository</a>.';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Alternative names are rendered as footnotes', function (macro) {
        let actual = macro.call('alternative_name.feature');
        return actual.then(function(result) {
            let dom = JSDOM.fragment(result);

            // Alternative name in simple cell
            assert.equal(dom.querySelectorAll("tbody td")[1].outerHTML,
            '<td class="full-support">10<sup><a href="#compatNote_1">1</a></sup></td>');
            assert.equal(dom.querySelector("#compatNote_1").outerHTML,
            '<p id="compatNote_1">1. Supported as <code>contextMenus.ContextType</code>.</p>');

            // Alternative name in cell with multipe support ranges
            assert.equal(dom.querySelectorAll("tbody td")[3].outerHTML,
            '<td class="full-support"><p>12</p><p>5<sup><a href="#compatNote_2">2</a></sup></p></td>');
            assert.equal(dom.querySelector("#compatNote_2").outerHTML,
            '<p id="compatNote_2">2. Supported as <code>CookieMonsterInterface</code>.</p>');
        });
    });

});
