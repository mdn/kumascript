/**
 * @prettier
 */
const url = require('url');

const { JSDOM } = require('jsdom');

const { beforeEachMacro,
        describeMacro,
        itMacro,
        lintHTML } = require('./utils');

const SUMMARIES = {
    'en-US': new Set([
        'Getting started',
        'Concepts',
        'User interface',
        'How to',
        'Porting',
        'Firefox workflow',
        'JavaScript APIs',
        'Manifest keys',
        'Browser themes',
        'Publishing add-ons',
        'Distributing add-ons',
        'Channels'
    ]),
    'fr': new Set([
        'Démarrage',
        'Concepts',
        'Interface Utilisateur',
        'Mode d\'emploi',
        'Portage',
        'Déroulement avec Firefox',
        'Les API JavaScript',
        'Clés de manifeste',
        'Thème de navigateur',
        'Publication de votre extension',
        'Distribuer votre module',
        'Canaux de discussions'
    ]),
    'ja': new Set([
        '始めましょう',
        '概念',
        'ユーザーインターフェイス',
        '逆引きリファレンス',
        '移行',
        'Firefox でのワークフロー',
        'JavaScript API 群',
        'Manifest keys',
        'ブラウザのテーマ',
        'アドオンを公開する',
        'アドオンの配布',
        'チャンネル'
    ]),
};

const MANIFEST_SLUG = 'Mozilla/Add-ons/WebExtensions/manifest.json';

function getMockResultForFetchJSONResource(doc_url) {
    const locale = url.parse(doc_url).pathname.split('/')[1];
    return {
        locale: `${locale}`,
        url: `/${locale}/docs/${MANIFEST_SLUG}`,
        subpages: [
            {
                locale: `${locale}`,
                url: `/${locale}/docs/${MANIFEST_SLUG}/author`,
                subpages: [],
                slug: `${MANIFEST_SLUG}/author`,
                title: 'author'
            },
            {
                locale: `${locale}`,
                url: `/${locale}/docs/${MANIFEST_SLUG}/background`,
                subpages: [],
                slug: `${MANIFEST_SLUG}/background`,
                title: 'background'
            },
            {
                locale: `${locale}`,
                url: `/${locale}/docs/${MANIFEST_SLUG}/theme`,
                subpages: [],
                slug: `${MANIFEST_SLUG}/theme`,
                title: 'theme'
            },
            {
                locale: `${locale}`,
                url: `/${locale}/docs/${MANIFEST_SLUG}/version`,
                subpages: [],
                slug: `${MANIFEST_SLUG}/version`,
                title: 'version'
            },
        ],
        slug: MANIFEST_SLUG,
        title: 'manifest.json'
    };
}

function checkSidebarDom(html, locale, is_under_web_ext_api=false) {
    // Lint the HTML
    expect(lintHTML(html)).toBeFalsy();
    const dom = JSDOM.fragment(html);
    const section = dom.querySelector('section.Quick_links');
    // Check the basics
    expect(section).toBeTruthy();
    // Check the total number of top-level list items that can be toggled
    expect(
        section.querySelectorAll('ol > li.toggle').length
    ).toEqual(SUMMARIES[locale].size);
    // Check that all links reference the proper locale or use https
    const num_total_links = section.querySelectorAll('a[href]').length;
    const num_valid_links = section.querySelectorAll(
        `a[href^="/${locale}/docs/Mozilla/Add-ons"], a[href^="https://"]`
    ).length;
    expect(num_valid_links).toEqual(num_total_links);
    // Check that one of the list item's details are open by default (or not)
    const details_open = section.querySelector(
        'ol > li.toggle > details[open]'
    );
    if (is_under_web_ext_api) {
        expect(details_open).toBeTruthy();
    } else {
        expect(details_open).toBeFalsy();
    }
    // Check a sample of the DOM for localized content
    for (const node of section.querySelectorAll('summary')) {
        expect(SUMMARIES[locale].has(node.textContent)).toBe(true);
    }
    // Check for "WebExtensions/manifest.json" details
    for (const name of ['author', 'background', 'theme', 'version']) {
        const href = `/${locale}/docs/${MANIFEST_SLUG}/${name}`;
        expect(section.querySelector(`li > a[href="${href}"]`)).toBeTruthy();
    }
}

describeMacro('AddonSidebar', function() {
    beforeEachMacro(function(macro) {
        // Mock calls to template('WebExtAPISidebar', [])
        macro.ctx.template = jest.fn((macro, args) => {
            // This template will be tested on its own, so nothing needed here.
            return '';
        });
        // Mock calls to MDN.fetchJSONResource(doc_url)
        macro.ctx.MDN.fetchJSONResource = jest.fn((doc_url) => {
            return getMockResultForFetchJSONResource(doc_url);
        });
    });

    for (const locale of ['en-US', 'fr', 'ja']) {
        itMacro(`with locale ${locale}`, function(macro) {
            macro.ctx.env.locale = locale;
            macro.ctx.env.slug = 'Mozilla/Add-ons/AMO';
            return macro.call().then(function(result) {
                expect(macro.ctx.template).toHaveBeenCalledTimes(1);
                checkSidebarDom(result, locale);
            });
        });
        itMacro(`with locale ${locale} under WebExtensions/API`, function(macro) {
            macro.ctx.env.locale = locale;
            macro.ctx.env.slug = 'Mozilla/Add-ons/WebExtensions/API/alarms';
            return macro.call().then(function(result) {
                expect(macro.ctx.template).toHaveBeenCalledTimes(1);
                checkSidebarDom(result, locale, true);
            });
        });
    }
});
