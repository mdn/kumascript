/* jshint node: true, mocha: true, esversion: 6 */

// Get necessary modules
const {itMacro, describeMacro} = require('./utils');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

// Set up Chai
chai.use(chaiAsPromised);

describeMacro("MDN:Common", () => {
    itMacro('require', macro => {
        return macro.require().then(pkg => {
            chai.assert.isObject(pkg);
            chai.assert.isFunction(pkg.link);
            chai.assert.isFunction(pkg.htmlEscapeArgs);
            chai.assert.isFunction(pkg.localString);
            chai.assert.isFunction(pkg.localStringMap);
            chai.assert.isFunction(pkg.getLocalString);
            chai.assert.isFunction(pkg.replacePlaceholders);
            chai.assert.isFunction(pkg.escapeQuotes);
            chai.assert.isFunction(pkg.trimSlugStart);
            chai.assert.isFunction(pkg.fetchCompatTableJSON);
            chai.assert.isFunction(pkg.getFileContent);
            chai.assert.isFunction(pkg.cacheFnIgnoreCacheControl);
            chai.assert.isFunction(pkg.memcacheSet);
            chai.assert.isFunction(pkg.memcacheGet);
            chai.assert.isFunction(pkg.defaults);
            chai.assert.isFunction(pkg.fetchJSONResource);
            chai.assert.isFunction(pkg.fetchHTTPResource);
            chai.assert.isFunction(pkg.listSeparator);
            chai.assert.isFunction(pkg.CSVToArray);
            chai.assert.isFunction(pkg.loadArrayFromCSV);
            chai.assert.isFunction(pkg.bzSearch);
            chai.assert.isFunction(pkg.siteURL);
        });
    });

    describe('test "trimSlugStart"', () => {
        itMacro('trimSlugStart(["Web", "API"])', macro => {
            return macro.require().then(mdn => {
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "API"], 'Web/API/Foo/bar'),
                    {base_slug: 'Web/API', result: ['Foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart("Web/API", 'Web/API/Foo/bar'),
                    {base_slug: 'Web/API', result: ['Foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "API"], ['Web', 'API', 'Foo', 'bar']),
                    {base_slug: 'Web/API', result: ['Foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart("Web/API", ['Web', 'API', 'Foo', 'bar']),
                    {base_slug: 'Web/API', result: ['Foo', 'bar']});

                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "API"], 'API/Foo/bar'),
                    {base_slug: 'API', result: ['Foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "API"], 'Mozilla/Gecko/Chrome/API/Foo/bar'),
                    {base_slug: 'Mozilla/Gecko/Chrome/API', result: ['Foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "API"], 'Mozilla/Gecko/Chrome/API/Web/API'),
                    {base_slug: 'Mozilla/Gecko/Chrome/API', result: ['Web', 'API']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "API"], 'Web/Foo/bar'),
                    {base_slug: '', result: ['Web', 'Foo', 'bar']});
            });
        });

        itMacro('trimSlugStart(["Web", "CSS"])', macro => {
            return macro.require().then(mdn => {
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "CSS"], 'Web/CSS/foo/bar'),
                    {base_slug: 'Web/CSS', result: ['foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart("Web/CSS", 'Web/CSS/foo/bar'),
                    {base_slug: 'Web/CSS', result: ['foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "CSS"], ['Web', 'CSS', 'foo', 'bar']),
                    {base_slug: 'Web/CSS', result: ['foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart("Web/CSS", ['Web', 'CSS', 'foo', 'bar']),
                    {base_slug: 'Web/CSS', result: ['foo', 'bar']});

                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "CSS"], 'CSS/foo/bar'),
                    {base_slug: 'CSS', result: ['foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "CSS"], 'Mozilla/Gecko/Chrome/CSS/foo/bar'),
                    {base_slug: 'Mozilla/Gecko/Chrome/CSS', result: ['foo', 'bar']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "CSS"], 'Mozilla/Gecko/Chrome/CSS/Web/CSS'),
                    {base_slug: 'Mozilla/Gecko/Chrome/CSS', result: ['Web', 'CSS']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "CSS"], 'Web/API/CSS/foo'),
                    {base_slug: '', result: ['Web', 'API', 'CSS', 'foo']});
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "CSS"], 'Web/Foo/bar'),
                    {base_slug: '', result: ['Web', 'Foo', 'bar']});
                // - Edge case: legacy `API/CSS/foo` -> `{base_slug: 'API/CSS', result: ['foo']}`,
                //   but such paths are no longer in use on MDN.
                chai.assert.deepEqual(
                    mdn.trimSlugStart(["Web", "CSS"], 'API/CSS/foo'),
                    {base_slug: 'API/CSS', result: ['foo']});
            });
        });
    });
});
