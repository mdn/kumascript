const { describeMacro, itMacro } = require('./utils.js');

/**
 * @typedef {object} TestCase
 * @property {string} title
 * @property {string[]} args
 * @property {string} expected
 */

/** @type {TestCase[]} */
const TEST_CASES = [
    {
        title: 'Obsolete overrides deprecated',
        args: ['deprecated', 'obsolete'],
        expected:
            '&nbsp;<span title="This is an obsolete API and is no longer guaranteed to work." class="icon-only-inline"><i class="icon-trash"> </i></span>'
    },
    {
        title: 'Non-standard comes first',
        args: ['deprecated', 'experimental', 'non-standard'],
        expected:
            '&nbsp;<span title="This API has not been standardized." class="icon-only-inline"><i class="icon-warning-sign"> </i></span>' +
            '&nbsp;<span title="This is an experimental API that should not be used in production code." class="icon-only-inline"><i class="icon-beaker"> </i></span>' +
            '&nbsp;<span title="This deprecated API should no longer be used, but will probably still work." class="icon-only-inline"><i class="icon-thumbs-down-alt"> </i></span>'
    },
    {
        title: 'Badges follow icons',
        args: ['readonly', 'experimental', 'non-standard'],
        expected:
            '&nbsp;<span title="This API has not been standardized." class="icon-only-inline"><i class="icon-warning-sign"> </i></span>' +
            '&nbsp;<span title="This is an experimental API that should not be used in production code." class="icon-only-inline"><i class="icon-beaker"> </i></span>' +
            '<span title="This value may not be changed." class="inlineIndicator readOnly readOnlyInline">Read only </span>'
    }
];

describeMacro('InlineBadges', () => {
    itMacro('Early return when no arguments are provided', async macro => {
        await expect(macro.call()).resolves.toBeFalsy();
    });

    for (const t of TEST_CASES) {
        itMacro(t.title, async macro => {
            let result = await macro.call(...t.args);
            expect(result).toEqual(t.expected);
        });
    }

    itMacro('Duplicate badge throws error', async macro => {
        await expect(macro.call('experimental', 'experimental')).rejects.toThrow(TypeError);
    });

    itMacro('Unknown badge throws error (reports used case)', async macro => {
        let { rejects } = expect(macro.call('__INVALID__'));
        await Promise.all([
            rejects.toThrow(TypeError),
            rejects.toThrow('Unknown badge: __INVALID__'),
        ]);
    });
});
