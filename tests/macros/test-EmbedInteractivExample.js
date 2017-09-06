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
            `<iframe class="interactive " width="100%" height="250" frameborder="0" src="https://interactive-examples.mdn.mozilla.net/pages/css/animation.html"></iframe><p class="interactive-editor-survey">We would like to get your feedback on our new interactive editor. If you have a minute, <a href="https://www.surveygizmo.com/s3/3780959/MDN-Interactive-Editor" rel="noopener">take our survey</a>, and contribute to the future of MDN.</p>`
        );
    });
    itMacro('Changes in settings and argument are reflected', function (macro) {
        macro.ctx.env.interactive_examples = {
            base_url: "https://www.fleetwood-mac.com",
        };
        return assert.eventually.equal(
            macro.call('pages/http/headers.html'),
            `<iframe class="interactive " width="100%" height="250" frameborder="0" src="https://www.fleetwood-mac.com/pages/http/headers.html"></iframe><p class="interactive-editor-survey">We would like to get your feedback on our new interactive editor. If you have a minute, <a href="https://www.surveygizmo.com/s3/3780959/MDN-Interactive-Editor" rel="noopener">take our survey</a>, and contribute to the future of MDN.</p>`
        );
    });
    itMacro('Trailing slash in setting and leading slash in argument', function (macro) {
        macro.ctx.env.interactive_examples = {
            base_url: "https://interactive-examples.mdn.mozilla.net/",
        };
        return assert.eventually.equal(
            macro.call('/pages/css/animation.html'),
            `<iframe class="interactive " width="100%" height="250" frameborder="0" src="https://interactive-examples.mdn.mozilla.net/pages/css/animation.html"></iframe><p class="interactive-editor-survey">We would like to get your feedback on our new interactive editor. If you have a minute, <a href="https://www.surveygizmo.com/s3/3780959/MDN-Interactive-Editor" rel="noopener">take our survey</a>, and contribute to the future of MDN.</p>`
        );
    });
});
