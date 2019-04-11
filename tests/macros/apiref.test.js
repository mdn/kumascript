/**
 * @prettier
 */
const { JSDOM } = require('jsdom');

const {
    beforeEachMacro,
    describeMacro,
    itMacro,
    lintHTML
} = require('./utils');

const GAMEPAD_SUBPAGES_EXPAND = [
    {
        json_modified: '2019-01-16T23:02:17.747616',
        subpages: [],
        tags: [
            'Property',
            'Gamepad API',
            'NeedsBetterSpecLink',
            'Reference',
            'NeedsMarkupWork',
            'API',
            'Référence(2)',
            'Games'
        ],
        locale: 'en-US',
        translations: [
            {
                uuid: '533ea9eb-06ae-4518-82bf-4f409ebae3d0',
                title: 'Gamepad.axes',
                url: '/ja/docs/Web/API/Gamepad/axes',
                tags: [
                    'API',
                    'Gamepad API',
                    'NeedsBetterSpecLink',
                    'Reference',
                    'NeedsMarkupWork',
                    'Property',
                    'Référence(2)',
                    'Games'
                ],
                summary:
                    '<a href="/ja/docs/Web/API/Gamepad" title="Gamepad API の Gamepad インターフェースはそれぞれのゲームパットやその他のコントローラーを定義し、ボタンのプッシュや軸位置やIDといった情報にアクセスできるようにします。"><code>Gamepad</code></a> インターフェースの <code><strong>Gamepad.axes</strong></code> プロパティは<span class="tlid-translation translation"><span title="">デバイス上に存在する軸を持つコントロールを表す配列を返します。</span></span> (例 : アナログスティック)。-',
                localization_tags: [],
                locale: 'ja',
                last_edit: '2018-12-18T04:32:23.760574',
                review_tags: []
            }
        ],
        summary:
            'The <code><strong>Gamepad.axes</strong></code> property of the <a href="/en-US/docs/Web/API/Gamepad" title="The Gamepad interface of the Gamepad API defines an individual gamepad or other controller, allowing access to information such as button presses, axis positions, and id."><code>Gamepad</code></a> interface returns an array representing the controls with axes present on the device (e.g. analog thumb sticks).-',
        id: 87761,
        review_tags: [],
        slug: 'Web/API/Gamepad/axes',
        uuid: 'c867795d-c9df-4919-b3ff-8f3809e0485a',
        title: 'Gamepad.axes',
        url: '/en-US/docs/Web/API/Gamepad/axes',
        modified: '2019-01-16T13:03:20.906343',
        label: 'Gamepad.axes',
        localization_tags: [],
        last_edit: '2018-07-20T12:20:59.066605',
        sections: [
            {
                id: 'Quick_Links',
                title: null
            },
            {
                id: 'Syntax',
                title: 'Syntax'
            },
            {
                id: 'Example',
                title: 'Example'
            },
            {
                id: 'Value',
                title: 'Value'
            },
            {
                id: 'Specifications',
                title: 'Specifications'
            },
            {
                id: 'Browser_compatibility',
                title: 'Browser compatibility'
            },
            {
                id: 'sect1',
                title: null
            },
            {
                id: 'sect2',
                title: null
            },
            {
                id: 'sect3',
                title: null
            },
            {
                id: 'sect4',
                title: null
            },
            {
                id: 'sect5',
                title: null
            },
            {
                id: 'sect6',
                title: null
            },
            {
                id: 'Legend',
                title: 'Legend'
            },
            {
                id: 'See_also',
                title: 'See also'
            }
        ]
    },

    {
        json_modified: '2019-01-16T23:01:57.128398',
        subpages: [],
        tags: [
            'Property',
            'Gamepad API',
            'NeedsBetterSpecLink',
            'Reference',
            'NeedsMarkupWork',
            'API',
            'Référence(2)',
            'Games'
        ],
        locale: 'en-US',
        translations: [
            {
                uuid: '741f5a5e-3026-4d86-ab47-b6fc653c2a74',
                title: 'Gamepad.buttons',
                url: '/ja/docs/Web/API/Gamepad/buttons',
                tags: [
                    'API',
                    'Gamepad API',
                    'NeedsBetterSpecLink',
                    'Reference',
                    'NeedsMarkupWork',
                    'Property',
                    'Référence(2)',
                    'Games'
                ],
                summary:
                    '<a href="/ja/docs/Web/API/Gamepad" title="Gamepad API の Gamepad インターフェースはそれぞれのゲームパットやその他のコントローラーを定義し、ボタンのプッシュや軸位置やIDといった情報にアクセスできるようにします。"><code>Gamepad</code></a> インターフェースの <code><strong>Gamepad.buttons</strong></code> プロパティは<span class="tlid-translation translation"><span title="">デバイス上に存在するボタンを表すオブジェクトの配列を返します。</span></span>',
                localization_tags: [],
                locale: 'ja',
                last_edit: '2018-12-18T15:36:54.445468',
                review_tags: []
            }
        ],
        summary:
            'The <code><strong>Gamepad.buttons</strong></code> property of the <a href="/en-US/docs/Web/API/Gamepad" title="The Gamepad interface of the Gamepad API defines an individual gamepad or other controller, allowing access to information such as button presses, axis positions, and id."><code>Gamepad</code></a> interface returns an array of <a href="/en-US/docs/Web/API/GamepadButton" title="The GamepadButton interface defines an individual button of a gamepad or other controller, allowing access to the current state of different types of buttons available on the control device."><code>gamepadButton</code></a> objects representing the buttons present on the device.',
        id: 87763,
        review_tags: [],
        slug: 'Web/API/Gamepad/buttons',
        uuid: '6b6f5f4d-81cb-4b65-81dc-88dc94bbd494',
        title: 'Gamepad.buttons',
        url: '/en-US/docs/Web/API/Gamepad/buttons',
        modified: '2019-01-16T13:03:39.199620',
        label: 'Gamepad.buttons',
        localization_tags: [],
        last_edit: '2018-07-20T12:21:09.854338',
        sections: [
            {
                id: 'Quick_Links',
                title: null
            },
            {
                id: 'Syntax',
                title: 'Syntax'
            },
            {
                id: 'Example',
                title: 'Example'
            },
            {
                id: 'Value',
                title: 'Value'
            },
            {
                id: 'Specifications',
                title: 'Specifications'
            },
            {
                id: 'Browser_compatibility',
                title: 'Browser compatibility'
            },
            {
                id: 'sect1',
                title: null
            },
            {
                id: 'sect2',
                title: null
            },
            {
                id: 'sect3',
                title: null
            },
            {
                id: 'sect4',
                title: null
            },
            {
                id: 'sect5',
                title: null
            },
            {
                id: 'sect6',
                title: null
            },
            {
                id: 'Legend',
                title: 'Legend'
            },
            {
                id: 'See_also',
                title: 'See also'
            }
        ]
    }
];

function checkResult(html, locale) {
    // Lint the HTML
    expect(lintHTML(html)).toBeFalsy();
    const dom = JSDOM.fragment(html);
    // Check that all links reference the proper locale or use https
    const num_total_links = dom.querySelectorAll('a[href]').length;
    const num_valid_links = dom.querySelectorAll(
        `a[href^="/${locale}/"], a[href^="https://"]`
    ).length;
    expect(num_valid_links).toEqual(num_total_links);
}

describeMacro('APIRef', function() {
    beforeEachMacro(function(macro) {
        // Mock calls to MDN.subpagesExpand
        macro.ctx.page.subpagesExpand = jest.fn(() => {
            return GAMEPAD_SUBPAGES_EXPAND;
        });
    });

    for (const locale of ['en-US', 'fr', 'ja']) {
        itMacro(`with locale ${locale}`, function(macro) {
            macro.ctx.env.locale = locale;
            macro.ctx.env.slug = 'Web/API/Gamepad';
            return macro.call('Gamepad API').then(function(result) {
                checkResult(result, locale);
            });
        });
    }
});
