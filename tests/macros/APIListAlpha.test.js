/**
 * @prettier
 */
const fs = require('fs');
const path = require('path');
const {
    beforeEachMacro,
    describeMacro,
    itMacro,
    assert,
} = require('./utils');

/**
 * @typedef {object} Page
 * @property {string[]} [tags]
 * @property {string} locale
 * @property {string} slug
 * @property {string} title
 * @property {string} url
 * @property {string} [summary]
 * @property {Page[]} [translations]
 */

/**
 * Load all the fixtures.
 */
const subpagesPath = path.resolve(__dirname, 'fixtures/APIListAlpha/top-level.json');
/** @type {Page[]} */
const subpagesJSON = JSON.parse(fs.readFileSync(subpagesPath, 'utf8'));

describeMacro('APIListAlpha', () => {
    beforeEachMacro(macro => {
        macro.ctx.page.subpagesExpand = jest.fn(async (page) => {
            expect(page).toEqual('/en-US/docs/Web/API');
            return subpagesJSON;
        });
    });

    itMacro('Expected result', macro => {
        return assert.eventually.equal(macro.call(), `<div class="index">
	<span>T</span>
	<ul>
		<li><span class="indexListRow"><span class="indexListTerm"><a href="/en-US/docs/Web/API/TestInterface"><code>TestInterface</code></a></span></span></li>
		<li><span class="indexListRow"><span class="indexListTerm"><a href="/en-US/docs/Web/API/TestInterface2"><code>TestInterface2</code></a></span></span></li>
		<li><span class="indexListRow"><span class="indexListTerm"><a href="/en-US/docs/Web/API/TestMixin"><code>TestMixin</code></a></span></span></li>
		<li><span class="indexListRow"><span class="indexListTerm"><a href="/en-US/docs/Web/API/TestOther" title="See this Discourse thread for details."><code>TestOther</code></a></span></span></li>
	</ul>
</div>`)
    });
});
