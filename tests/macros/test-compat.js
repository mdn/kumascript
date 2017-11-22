/* jshint node: true, mocha: true, esversion: 6 */

const fs = require('fs'),
      path = require('path'),
      sinon = require('sinon'),
      utils = require('./utils'),
      chai = require('chai'),
      chaiAsPromised = require('chai-as-promised'),
      jsdom = require('jsdom'),
      extend = require('extend'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro,
      beforeEachMacro = utils.beforeEachMacro,
      fixture_dir = path.resolve(__dirname, 'fixtures/compat');

const { JSDOM } = jsdom;

// Let's add 'eventually' to assert so we can work with promises.
chai.use(chaiAsPromised);

let fixtureCompatData = {};
fs.readdirSync(fixture_dir).forEach(function(fn) {
    fixtureCompatData = extend(true, fixtureCompatData, JSON.parse(
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

    // Different content areas have different platforms (desktop, mobile, server)
    // which consist of different browsers
    // Tests content_areas.json
    itMacro('Creates correct platform and browser columns for API data', function (macro) {
        return macro.call('api.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table').classList),
              'bc-table-web');
            assert.equal(dom.querySelector('.bc-platform-desktop').colSpan,
              '6');
            assert.equal(dom.querySelector('.bc-platform-mobile').colSpan,
              '7');
        });
    });
    itMacro('Creates correct platform and browser columns for CSS data', function (macro) {
        return macro.call('css.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table').classList),
              'bc-table-web');
            assert.equal(dom.querySelector('.bc-platform-desktop').colSpan,
              '6');
            assert.equal(dom.querySelector('.bc-platform-mobile').colSpan,
              '7');
        });
    });
    itMacro('Creates correct platform and browser columns for HTML data', function (macro) {
        return macro.call('html.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table').classList),
              'bc-table-web');
            assert.equal(dom.querySelector('.bc-platform-desktop').colSpan,
              '6');
            assert.equal(dom.querySelector('.bc-platform-mobile').colSpan,
              '7');
        });
    });
    itMacro('Creates correct platform and browser columns for HTTP data', function (macro) {
        return macro.call('http.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table').classList),
              'bc-table-web');
            assert.equal(dom.querySelector('.bc-platform-desktop').colSpan,
              '6');
            assert.equal(dom.querySelector('.bc-platform-mobile').colSpan,
              '7');
        });
    });
    itMacro('Creates correct platform and browser columns for JavaScript data', function (macro) {
        return macro.call('javascript.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table').classList),
              'bc-table-js');
            assert.equal(dom.querySelector('.bc-platform-desktop').colSpan,
              '6');
            assert.equal(dom.querySelector('.bc-platform-mobile').colSpan,
              '7');
            assert.equal(dom.querySelector('.bc-platform-server').colSpan,
              '1');
        });
    });
    itMacro('Creates correct platform and browser columns for WebExtensions data', function (macro) {
        return macro.call('webextensions.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table').classList),
              'bc-table-ext');
            assert.equal(dom.querySelector('.bc-platform-desktop').colSpan,
              '4');
            assert.equal(dom.querySelector('.bc-platform-mobile').colSpan,
              '1');
        });
    });


    // Tests feature_labels.json and status icons
    itMacro('Creates correct feature labels for bare features', function (macro) {
        return macro.call('api.bareFeature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.equal(dom.querySelector('.bc-table tbody tr th').innerHTML,
              'Basic support');
            assert.equal(dom.querySelector('.bc-table tbody tr:nth-child(2) th').innerHTML,
              '<code>bareSubFeature</code>');
        });
    });
    itMacro('Creates correct feature labels for features with descriptions', function (macro) {
        return macro.call('api.feature_with_description').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.equal(dom.querySelector('.bc-table tbody tr th').innerHTML,
              'Basic support');
            assert.equal(dom.querySelector('.bc-table tbody tr:nth-child(2) th').innerHTML,
              '<code>Interface()</code> constructor');
        });
    });
    itMacro('Creates correct feature labels for features with an MDN URL', function (macro) {
        return macro.call('api.feature_with_mdn_url').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.equal(dom.querySelector('.bc-table tbody tr th').innerHTML,
              'Basic support');
            assert.equal(dom.querySelector('.bc-table tbody tr:nth-child(2) th').innerHTML,
              '<a href="/docs/Web/HTTP/Headers/Content-Security-Policy/child-src"><code>subfeature_with_mdn_url</code></a>');
        });
    });
    itMacro('Creates correct feature labels for features with an MDN URL and a description', function (macro) {
        return macro.call('api.feature_with_mdn_url_and_description').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.equal(dom.querySelector('.bc-table tbody tr th').innerHTML,
              'Basic support');
            assert.equal(dom.querySelector('.bc-table tbody tr:nth-child(2) th').innerHTML,
              '<a href="/docs/Web/HTTP/Headers/Content-Security-Policy/child-src">CSP: child-src</a>');
        });
    });
    itMacro('Creates correct labels for experimental/non-standard features', function (macro) {
        return macro.call('api.experimental_feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.equal(dom.querySelector('.bc-table tbody tr th').textContent,
              'Basic support Experimental');
            assert.equal(dom.querySelector('.bc-table tbody tr:nth-child(2) th').textContent,
              'experimental_non-standard_sub_feature ExperimentalNon-standard');
        });
    });
    itMacro('Creates correct labels for deprecated features with a description', function (macro) {
        return macro.call('api.deprecated_feature_with_description').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.equal(dom.querySelector('.bc-table tbody tr th').textContent,
              'Basic support Deprecated');
            assert.equal(dom.querySelector('.bc-table tbody tr:nth-child(2) th').textContent,
              'Deprecated syntax Deprecated');
        });
    });


    // Test different support cells, like yes, no, version, partial support
    // Tests support_variations.json
    itMacro('Creates correct cell content for no support', function (macro) {
        return macro.call('html.no_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-no');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'No support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              'No');
        });
    });
    itMacro('Creates correct cell content for unknown version support', function (macro) {
        return macro.call('html.unknown_version_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-yes');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'Full support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              'Yes');
        });
    });
    itMacro('Creates correct cell content for support with a known version', function (macro) {
        return macro.call('html.versioned_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-yes');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'Full support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              '25');
        });
    });
    itMacro('Creates correct cell content for removed support with known versions', function (macro) {
        return macro.call('html.removed_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-no');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'No support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              '25 — 35');
        });
    });
    itMacro('Creates correct cell content for removed support with unknown support start', function (macro) {
        return macro.call('html.removed_support_unknown_start').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-no');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'No support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              '? — 35');
        });
    });
    itMacro('Creates correct cell content for removed support with unknown support end', function (macro) {
        return macro.call('html.removed_support_unknown_end').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-no');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'No support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              '25 — ?');
        });
    });
    itMacro('Creates correct cell content for removed support with unknown support range', function (macro) {
        return macro.call('html.removed_support_unknown_range').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-no');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'No support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              '? — ?');
        });
    });
    itMacro('Creates correct cell content for partial support and known version number', function (macro) {
        return macro.call('html.partial_versioned_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-partial');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'Partial support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              '25');
        });
    });
    itMacro('Creates correct cell content for partial support and unknown version number', function (macro) {
        return macro.call('html.partial_unknown_version_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-partial');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'Partial support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              ' Partial');
        });
    });
    itMacro('Creates correct cell content for partial support and no support', function (macro) {
        return macro.call('html.partial_no_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-partial');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'Partial support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              ' Partial');
        });
    });
    itMacro('Creates correct cell content for partial support and unknown support', function (macro) {
        return macro.call('html.partial_unknown_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-partial');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'Partial support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              ' Partial');
        });
    });
    itMacro('Creates correct cell content for partial support and removed support', function (macro) {
        return macro.call('html.partial_removed_support').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td:nth-child(4)').classList),
              'bc-supports-no');
            assert.equal(dom.querySelector('.bc-table tbody tr td:nth-child(4) abbr span').textContent,
              'No support');
            assert.include(dom.querySelector('.bc-table tbody tr td:nth-child(4)').textContent,
              '25 — 35');
        });
    });
    itMacro('Creates correct cell content for partial support due to subfeature support with different version', function (macro) {
        return macro.call('html.partial_support_due_to_subfeature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr:nth-child(2) td:nth-child(4)').classList),
              'bc-supports-partial');
            assert.equal(dom.querySelector('.bc-table tbody tr:nth-child(2) td:nth-child(4) abbr span').textContent,
              'Partial support');
            assert.include(dom.querySelector('.bc-table tbody tr:nth-child(2) td:nth-child(4)').textContent,
              '25');
        });
    });


    // Test icons in main cells
    itMacro('Adds an icon and a note section if a current main feature has an alternative name', function (macro) {
        return macro.call('alternative_name.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td').classList),
              'bc-has-history');
            assert.include(Array.from(dom.querySelector('.bc-icons i').classList),
              'ic-altname');
        });
    });
    itMacro('Adds an icon and a note section if a current main feature has notes', function (macro) {
        return macro.call('notes.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td').classList),
              'bc-has-history');
            assert.include(Array.from(dom.querySelector('.bc-icons i').classList),
              'ic-footnote');
        });
    });
    itMacro('Adds an icon and a note section if a current main feature has a flag', function (macro) {
        return macro.call('flags.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td').classList),
              'bc-has-history');
            assert.include(Array.from(dom.querySelector('.bc-icons i').classList),
              'ic-disabled');
        });
    });
    itMacro('Adds an icon and a note section if a current main feature has a prefix', function (macro) {
        return macro.call('prefixes.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.include(Array.from(dom.querySelector('.bc-table tbody tr td').classList),
              'bc-has-history');
            assert.include(Array.from(dom.querySelector('.bc-icons i').classList),
              'ic-prefix');
        });
    });


    // Test flags
    itMacro('Creates correct notes for flags', function (macro) {
        return macro.call('flags.feature').then(function(result) {
            let dom = JSDOM.fragment(result);
            assert.equal(dom.querySelectorAll('section.bc-history dl dd')[0].textContent,
              'Disabled From version 10: this feature is behind the Enable experimental Web Platform features preference. To change preferences in Chrome, visit chrome://flags.');
            assert.equal(dom.querySelectorAll('section.bc-history dl dd')[1].textContent,
              'Disabled From version 17: this feature is behind the --number-format-to-parts runtime flag.');
            assert.equal(dom.querySelectorAll('section.bc-history dl dd')[2].textContent,
               ''); // empty for the "version_added: 12" range that has no flag
            assert.equal(dom.querySelectorAll('section.bc-history dl dd')[3].textContent,
              'Disabled From version 5: this feature is behind the layout.css.vertical-text.enabled preference (needs to be set to true). To change preferences in Firefox, visit about:config.');
            assert.equal(dom.querySelectorAll('section.bc-history dl dd')[4].textContent,
              'Disabled From version 55 until version 60 (exclusive): this feature is behind the --datetime-format-to-parts compile flag.');
        });
    });
});
