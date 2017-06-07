/* jshint node: true, mocha: true, esversion: 6 */

var utils = require('./utils'),
    chai = require('chai'),
    chaiAsPromised = require('chai-as-promised'),
    assert = chai.assert,
    itMacro = utils.itMacro,
    describeMacro = utils.describeMacro;

// Let's add "eventually" to assert so we can work with promises.
chai.use(chaiAsPromised);

describeMacro('specname', function () {
    itMacro('One argument (en-US)', function (macro) {
        return assert.eventually.equal(
            macro.call('Alarm API'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/" hreflang="en" lang="en" class="external" title="The \'Web Alarms API\' specification">Web Alarms API</a>`
        );
    });
    itMacro('One argument (fr)', function (macro) {
        macro.ctx.env.locale = 'fr';
        return assert.eventually.equal(
            macro.call('Alarm API'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/" hreflang="en" lang="en" class="external" title="La spécificaction 'Web Alarms API'">Web Alarms API</a>`
        );
    });
    itMacro('One argument (de)', function (macro) {
        macro.ctx.env.locale = 'de';
        return assert.eventually.equal(
            macro.call('Alarm API'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/" hreflang="en" lang="en" class="external" title="Die 'Web Alarms API' Spezifikation">Web Alarms API</a>`
        );
    });
    itMacro('One argument (ru)', function (macro) {
        macro.ctx.env.locale = 'ru';
        return assert.eventually.equal(
            macro.call('Alarm API'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/" hreflang="en" lang="en" class="external" title="Спецификация 'Web Alarms API'">Web Alarms API</a>`
        );
    });
    itMacro('One argument (ja)', function (macro) {
        macro.ctx.env.locale = 'ja';
        return assert.eventually.equal(
            macro.call('Alarm API'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/" hreflang="en" lang="en" class="external" title="Web Alarms APIの仕様書">Web Alarms API</a>`
        );
    });
    itMacro('One argument (zh-CN)', function (macro) {
        macro.ctx.env.locale = 'zh-CN';
        return assert.eventually.equal(
            macro.call('Alarm API'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/" hreflang="en" lang="en" class="external" title="Web Alarms API">Web Alarms API</a>`
        );
    });
    itMacro('Two arguments (en-US)', function (macro) {
        return assert.eventually.equal(
            macro.call('Alarm API', 'XXX'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/XXX" hreflang="en" lang="en" class="external" title="The \'Web Alarms API\' specification">Web Alarms API</a>`
        );
    });
    itMacro('Three arguments (en-US)', function (macro) {
        return assert.eventually.equal(
            macro.call('Alarm API', 'XXX', 'YYY'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/XXX" hreflang="en" lang="en" class="external">Web Alarms API<br><small lang="en-US">The definition of \'YYY\' in that specification.</small></a>`
        );
    });
    itMacro('Three arguments (fr)', function (macro) {
        macro.ctx.env.locale = 'fr';
        return assert.eventually.equal(
            macro.call('Alarm API', 'XXX', 'YYY'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/XXX" hreflang="en" lang="en" class="external">Web Alarms API<br><small lang="fr">La définition de \'YYY\' dans cette spécification.</small></a>`
        );
    });
    itMacro('Three arguments (de)', function (macro) {
        macro.ctx.env.locale = 'de';
        return assert.eventually.equal(
            macro.call('Alarm API', 'XXX', 'YYY'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/XXX" hreflang="en" lang="en" class="external">Web Alarms API<br><small lang="de">Die Definition von \'YYY\' in dieser Spezifikation.</small></a>`
        );
    });
    itMacro('Three arguments (ru)', function (macro) {
        macro.ctx.env.locale = 'ru';
        return assert.eventually.equal(
            macro.call('Alarm API', 'XXX', 'YYY'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/XXX" hreflang="en" lang="en" class="external">Web Alarms API<br><small lang="ru">Определение \'YYY\' в этой спецификации.</small></a>`
        );
    });
    itMacro('Three arguments (ja)', function (macro) {
        macro.ctx.env.locale = 'ja';
        return assert.eventually.equal(
            macro.call('Alarm API', 'XXX', 'YYY'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/XXX" hreflang="en" lang="en" class="external">Web Alarms API<br><small lang="ja">YYY の定義</small></a>`
        );
    });
    itMacro('Three arguments (zh-CN)', function (macro) {
        macro.ctx.env.locale = 'zh-CN';
        return assert.eventually.equal(
            macro.call('Alarm API', 'XXX', 'YYY'),
            `<a href="https://www.w3.org/2012/sysapps/web-alarms/XXX" hreflang="en" lang="en" class="external">Web Alarms API<br><small lang="zh-CN">YYY</small></a>`
        );
    });
    itMacro('Unknown (en-US)', function (macro) {
        return assert.eventually.equal(
            macro.call('fleetwood mac'),
            `<a href="about:unknown" hreflang="en" lang="en" class="external" title="The \'Unknown\' specification">Unknown</a>`
        );
    });
});
