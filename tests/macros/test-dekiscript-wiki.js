/* jshint node: true, mocha: true, esversion: 6 */

const utils = require('./utils'),
      chai = require('chai'),
      chaiAsPromised = require('chai-as-promised'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro,
      beforeEachMacro = utils.beforeEachMacro;

// Let's add "eventually" to assert so we can work with promises.
chai.use(chaiAsPromised);

describeMacro('dekiscript-wiki', function () {
    itMacro('require', function (macro) {
        return macro.require().then(function (pkg) {
            assert.isObject(pkg);
            assert.isFunction(pkg.kumaPath);
            assert.isFunction(pkg.escapeQuotes);
            assert.isFunction(pkg.buildAbsoluteURL);
            assert.isFunction(pkg.pageExists);
            assert.isFunction(pkg.page);
            assert.isFunction(pkg.pageIgnoreCacheControl);
            assert.isFunction(pkg.getPage);
            assert.isFunction(pkg.getHeadings);
            assert.isFunction(pkg.uri);
            assert.isFunction(pkg.languages);
            assert.isFunction(pkg.tree);
        });
    });
    describe('test "buildAbsoluteURL"', function () {
        beforeEachMacro(function (macro) {
            return macro.require().then(function (pkg) {
                macro.buildAbsoluteURL = pkg.buildAbsoluteURL;
            });
        });
        itMacro('with "/docs", leading "/", spaces', function (macro) {
            macro.ctx.env.url += 'en-US/docs/Web';
            assert.equal(
                macro.buildAbsoluteURL(
                    '/en-US/docs/Learn/Getting started%20with the%20web'
                ),
                'https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web'
            );
        });
        itMacro('without "/docs", leading "/", spaces', function (macro) {
            macro.ctx.env.url += 'en-US/docs/Learn';
            assert.equal(
                macro.buildAbsoluteURL('Web/HTTP'),
                'https://developer.mozilla.org/en-US/docs/Web/HTTP'
            );
        });
    });
    describe('test "uri"', function () {
        beforeEachMacro(function (macro) {
            return macro.require().then(function (pkg) {
                macro.uri = pkg.uri;
            });
        });
        itMacro('with "/docs", leading "/", spaces', function (macro) {
            macro.ctx.env.url += 'en-US/docs/Web';
            assert.equal(
                macro.uri(
                    '/en-US/docs/Learn/Getting started%20with the%20web'
                ),
                'https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web'
            );
        });
        itMacro('without "/docs", leading "/", spaces', function (macro) {
            macro.ctx.env.url += 'en-US/docs/Learn';
            assert.equal(
                macro.uri('Web/HTTP'),
                'https://developer.mozilla.org/en-US/docs/Web/HTTP'
            );
        });
        itMacro('with "/docs", leading "/", spaces, query', function (macro) {
            macro.ctx.env.url += 'en-US/docs/Web';
            assert.equal(
                macro.uri(
                    '/en-US/docs/Learn/Getting started%20with the%20web',
                    'raw=1'
                ),
                'https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web?raw=1'
            );
        });
    });
});
