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

describeMacro('CompatNightly', function () {
    itMacro('Correct DOM with no arguments', function (macro) {
        return macro.call().then(function (result) {
            let dom = JSDOM.fragment(result);
            assert.equal(dom.firstElementChild.tagName, 'EM');
            assert.equal(dom.firstElementChild.childElementCount, 0);
            assert.equal(dom.textContent, 'Nightly build');
        });
    });

    itMacro('Correct DOM for Firefox', function (macro) {
        return macro.call('firefox').then(function (result) {
            let dom = JSDOM.fragment(result);
            let element = dom.firstElementChild;
            assert.equal(element.tagName, 'EM');
            assert.equal(element.childElementCount, 1);
            element = element.firstElementChild;
            assert.equal(element.tagName, 'A');
            assert.equal(element.getAttribute('href'), 'https://nightly.mozilla.org/');
            assert.equal(dom.textContent, 'Nightly build');
        });
    });

    itMacro('Correct DOM for Firefox Android', function (macro) {
        return macro.call('firefoxmobile').then(function (result) {
            let dom = JSDOM.fragment(result);
            let element = dom.firstElementChild;
            assert.equal(element.tagName, 'EM');
            assert.equal(element.childElementCount, 1);
            element = element.firstElementChild;
            assert.equal(element.tagName, 'A');
            assert.equal(element.getAttribute('href'), 'https://wiki.mozilla.org/Mobile/Platforms/Android%23Download_Fennec_Nightly_Builds');
            assert.equal(dom.textContent, 'Nightly build');
        });
    });

    itMacro('Correct DOM for Safari', function (macro) {
        return macro.call('safari').then(function (result) {
            let dom = JSDOM.fragment(result);
            let element = dom.firstElementChild;
            assert.equal(element.tagName, 'EM');
            assert.equal(element.childElementCount, 1);
            element = element.firstElementChild;
            assert.equal(element.tagName, 'A');
            assert.equal(element.getAttribute('href'), 'https://nightly.webkit.org/');
            assert.equal(dom.textContent, 'Nightly build');
        });
    });

    itMacro('Correct DOM for Chrome', function (macro) {
        return macro.call('chrome').then(function (result) {
            let dom = JSDOM.fragment(result);
            let element = dom.firstElementChild;
            assert.equal(element.tagName, 'EM');
            assert.equal(element.childElementCount, 1);
            element = element.firstElementChild;
            assert.equal(element.tagName, 'A');
            assert.equal(element.getAttribute('href'), 'https://commondatastorage.googleapis.com/chromium-browser-snapshots/index.html');
            assert.equal(dom.textContent, 'Nightly build');
        });
    });

    itMacro('Correct DOM for Opera', function (macro) {
        return macro.call('opera').then(function (result) {
            let dom = JSDOM.fragment(result);
            let element = dom.firstElementChild;
            assert.equal(element.tagName, 'EM');
            assert.equal(element.childElementCount, 1);
            element = element.firstElementChild;
            assert.equal(element.tagName, 'A');
            assert.equal(element.getAttribute('href'), 'https://snapshot.opera.com/');
            assert.equal(dom.textContent, 'Nightly build');
        });
    });
});
