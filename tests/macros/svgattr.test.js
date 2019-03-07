/**
 * @prettier
 */
const { assert, itMacro, describeMacro } = require('./utils');

describeMacro('SVGAttr', function() {
    for (const locale of ['en-US', 'de', 'fr']) {
        for (const attr of ['min', 'max']) {
            itMacro(`${locale} ${attr} `, function(macro) {
                macro.ctx.env.locale = locale;
                return assert.eventually.equal(
                    macro.call(attr),
                    `<code><a href="/${locale}/docs/Web/SVG/Attribute/${attr}">${attr}</a></code>`
                );
            });
        }
    }
});
