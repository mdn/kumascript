/* jshint node: true, mocha: true, esversion: 6 */

const fs = require('fs'),
      path = require('path'),
      sinon = require('sinon'),
      utils = require('./utils'),
      chai = require('chai'),
      chaiAsPromised = require('chai-as-promised'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro,
      beforeEachMacro = utils.beforeEachMacro,
      fixture_dir = path.resolve(__dirname, 'fixtures/compat');

// Let's add "eventually" to assert so we can work with promises.
chai.use(chaiAsPromised);

// Load fixture data.
const fixtures = {
    alternative_name: {
        data: null,
        dataFile: 'alternative_name.json',
        expected: '',
        expectedFile: 'alternative_name-expected.txt',
    }
};

for (const name in fixtures) {
    fixtures[name].data = JSON.parse(
        fs.readFileSync(path.resolve(fixture_dir, fixtures[name].dataFile), 'utf8')
    );

    fixtures[name].expected =
        fs.readFileSync(path.resolve(fixture_dir, fixtures[name].expectedFile), 'utf8');
}

describeMacro('Compat', function () {

    beforeEachMacro(function (macro) {
        macro.ctx.require = sinon.stub();
        macro.ctx.require.withArgs('mdn-browser-compat-data').returns(
        fixtures.alternative_name.data
   );
    });

    itMacro('Outputs a message if there is no data for the query "foo.bar"', function (macro) {
        let actual = macro.call('foo.bar');
        let expected = 'No compatibility data found. Please contribute data for "foo.bar" (depth: 1) to the <a href="https://github.com/mdn/browser-compat-data">MDN compatibility data repository</a>.';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Alternative names are written as footnotes', function (macro) {
        // do the magic to load the alternative_name stub instead of the real data
        let actual = macro.call('webextensions.api.menus.ContextType');
        let expected = fixtures.alternative_name.expected;
        return assert.eventually.equal(actual, expected);
    });

});
