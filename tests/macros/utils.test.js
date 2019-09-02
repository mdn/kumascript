/**
 * @prettier
 */
const { lintHTML, readFixture, readJSONFixture } = require('./utils');

const ERROR_TEST_CASES = [
    {
        title: 'with an invalid HTML element',
        html: '<junk></junk>',
        error: 'Element “junk” not allowed'
    },
    {
        title: 'with an HTML element missing its closing tag',
        html: '<div>closing tag has gone missing',
        error: 'Unclosed element “div”'
    },
    {
        title: 'with an illegal link attribute',
        html: '<a href="https://example.com" junk="xxx">an example</a>',
        error: 'Attribute “junk” not allowed on element “a” at this point'
    },
    {
        title: 'with an illegal value for a link attribute',
        html: '<a href="https://example.com" rel="xxx">an example</a>',
        error: 'Bad value “xxx” for attribute “rel” on element “a”'
    }
];

describe('Macro test utils', function() {
    describe('test lintHTML function', function() {
        for (const test of ERROR_TEST_CASES) {
            it(test.title, function() {
                expect(lintHTML(test.html)).toContain(test.error);
            });
        }
        it('with valid HTML input', function() {
            expect(lintHTML('<div>This is nice</div>')).toBeFalsy();
        });
    });

    it('`readFixture` works', function() {
        let result = String(readFixture('utils-test/fixture.txt')).trim();
        expect(result).toEqual('Lorem ipsum...');
    });

    it('`readJSONFixture` works', function() {
        const result = readJSONFixture('utils-test', 'fixture');
        expect(result).toEqual({ 'utils-test': true });
    });
});
