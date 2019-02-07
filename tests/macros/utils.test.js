/**
 * @prettier
 */
const { readJSONFixture } = require('./utils');

describe('Macro test utils', function() {
    it('`readJSONFixture` works', function() {
        const result = readJSONFixture('utils-test');
        expect(result).toEqual({ 'utils-test': true });
    });
});
