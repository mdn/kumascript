/* jshint node: true, mocha: true, esversion: 6 */
/* eslint-env node, mocha */

const utils = require('./utils'),
      chai = require('chai'),
      chaiAsPromised = require('chai-as-promised'),
      jsdom = require('jsdom'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro;

const { JSDOM } = jsdom;

// Let's add 'eventually' to assert so we can work with promises.
chai.use(chaiAsPromised);

describeMacro('CompatGeckoDesktop', function () {

    itMacro('Correct DOM for unknown Firefox versions', function (macro) {
        let actual = macro.call('Unknown');
        let expected = 'Unknown (Unknown)';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Correct DOM for Firefox 1.0', function (macro) {
        let actual = macro.call('1');
        let expected = '1.0 (1.7 or earlier)';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Correct DOM for old Firefox versions', function (macro) {
        let actual = macro.call('2');
        let expected = '<a href="/en-US/docs/Mozilla/Firefox/Releases/4" title="Released on 2011-03-22.">4</a> (2)';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Correct DOM for modern Firefox versions', function (macro) {
        let actual = macro.call('5');
        let expected = '<a href="/en-US/docs/Mozilla/Firefox/Releases/5" title="Released on 2011-06-21.">5</a>';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Correct DOM for title-less Firefox versions', function (macro) {
        let actual = macro.call('60');
        let expected = '<a href="/en-US/docs/Mozilla/Firefox/Releases/60">60</a>';
        return assert.eventually.equal(actual, expected);
    });
});

describeMacro('CompatGeckoMobile', function () {

    itMacro('Correct DOM for unknown Firefox Android versions', function (macro) {
        let actual = macro.call('Unknown');
        let expected = 'Unknown';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Correct DOM for old Firefox Android versions', function (macro) {
        let actual = macro.call('2');
        let expected = '4 (2)';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Correct DOM for modern Firefox Android versions', function (macro) {
        let actual = macro.call('5');
        let expected = '5';
        return assert.eventually.equal(actual, expected);
    });
});

describeMacro('CompatEdge', function () {

    itMacro('Correct DOM for unknown Edge versions', function (macro) {
        let actual = macro.call('Unknown');
        let expected = 'Unknown (Unknown)';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Correct DOM for EdgeHTML 14.14393', function (macro) {
        let actual = macro.call('14.14393');
        let expected = '<a href="https://developer.microsoft.com/en-us/microsoft-edge/platform/changelog/desktop/14393/" title="Released on 2016-08-02.">38</a> (14.14393)';
        return assert.eventually.equal(actual, expected);
    });

    itMacro('Correct DOM for EdgeHTML 17', function (macro) {
        let actual = macro.call('17');
        let expected = 'Unknown (17)';
        return assert.eventually.equal(actual, expected);
    });
});
