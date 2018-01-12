/* jshint node: true, mocha: true, esversion: 6 */

var utils = require('./utils'),
    chai = require('chai'),
    chaiAsPromised = require('chai-as-promised'),
    assert = chai.assert,
    itMacro = utils.itMacro,
    describeMacro = utils.describeMacro;

// Let's add "eventually" to assert so we can work with promises.
chai.use(chaiAsPromised);

describeMacro('EmbedInteractiveExample', function () {
    itMacro('Typical settings and argument', function (macro) {
        macro.ctx.env.interactive_examples = {
            base_url: "https://interactive-examples.mdn.mozilla.net",
        };
        return assert.eventually.equal(
            macro.call('pages/css/animation.html'),
            `<iframe class="interactive  " width="100%" height="250" frameborder="0" src="https://interactive-examples.mdn.mozilla.net/pages/css/animation.html" title="MDN Web Docs Interactive Example"></iframe>`
        );
    });
    itMacro('Changes in settings and argument are reflected', function (macro) {
        macro.ctx.env.interactive_examples = {
            base_url: "https://www.fleetwood-mac.com",
        };
        return assert.eventually.equal(
            macro.call('pages/http/headers.html'),
            `<iframe class="interactive  " width="100%" height="250" frameborder="0" src="https://www.fleetwood-mac.com/pages/http/headers.html" title="MDN Web Docs Interactive Example"></iframe>`
        );
    });
    itMacro('Trailing slash in setting and leading slash in argument', function (macro) {
        macro.ctx.env.interactive_examples = {
            base_url: "https://interactive-examples.mdn.mozilla.net/",
        };
        return assert.eventually.equal(
            macro.call('/pages/css/animation.html'),
            `<iframe class="interactive  " width="100%" height="250" frameborder="0" src="https://interactive-examples.mdn.mozilla.net/pages/css/animation.html" title="MDN Web Docs Interactive Example"></iframe>`
        );
    });
});
