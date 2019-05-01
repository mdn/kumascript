/**
 * @prettier
 */
const { assert, describeMacro, beforeEachMacro, itMacro } = require('./utils');
const jsdom = require('jsdom');

/** @type {Record<string, {events: string[]}>} */
const GROUP_DATA = {
    "WebRTC": { events: ["datachannel"] },

    "DOM Events": { events: ["click"] },
    "HTML DOM":   { events: ["click"] },
    "SVG":        { events: ["click"] },

    "Web Notifications": { events: ["click"] },
};

/**
 * @param {DocumentFragment} dom
 * @param {string} locale
 * @param {string} expected_summary
 * @param {boolean} found_one
 */
function checkSidebarDom(dom, locale, expected_summary, found_one) {
    let section = dom.querySelector('section');
    assert(
        section.classList.contains('Quick_links'),
        'Section does not contain Quick_links class'
    );

    let summaries = dom.querySelectorAll('summary');
    assert.equal(summaries[0].textContent, expected_summary);

    let details = dom.querySelectorAll('details');
    if (found_one) {
        assert.equal(details.length, 1);
        assert.isTrue(details[0].hasAttribute('open'));
    } else {
        assert.isAbove(details.length, 1);
        for (var detail of details.values()) {
            assert.isFalse(detail.hasAttribute('open'));
        }
    }
}

describeMacro('EventRef', function() {
    beforeEachMacro(macro => {
        let realTemplate = macro.ctx.template;
        macro.ctx.template = jest.fn(
            async name => {
                switch (String(name).toLowerCase()) {
                    case "groupdata":
                        return JSON.stringify([GROUP_DATA]);
                    default:
                        return realTemplate(name);
                }
            }
        );
    });

    itMacro('No output in preview', function(macro) {
        macro.ctx.env.slug = '';
        macro.ctx.env.locale = 'en-US';
        return assert.eventually.equal(macro.call(), '');
    });

    itMacro(
        'Creates a sidebar for an event in one group in en-US locale',
        macro => {
            macro.ctx.env.slug = 'Web/Events/datachannel';
            macro.ctx.env.locale = 'en-US';
            return macro.call().then(result => {
                let dom = jsdom.JSDOM.fragment(result);
                checkSidebarDom(dom, 'en-US', 'WebRTC events', true);
            });
        }
    );

    itMacro(
        'Creates a sidebar for an event in multiple groups in fr locale',
        macro => {
            macro.ctx.env.slug = 'Web/Events/click';
            macro.ctx.env.locale = 'fr';
            return macro.call().then(result => {
                let dom = jsdom.JSDOM.fragment(result);
                checkSidebarDom(dom, 'fr', 'DOM events', false);
            });
        }
    );
});
