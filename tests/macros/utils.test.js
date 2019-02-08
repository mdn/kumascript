/**
 * @prettier
 */
const { platform } = require('os');

const { readFixture, readJSONFixture } = require('./utils');

describe('Macro test utils', function() {
    it('`readFixture` works', function() {
        let result = String(readFixture('utils-test.txt'));

        // prevent false positives from git.core.autocrlf on Windows
        if (platform() === 'win32') {
            result.replace(/\r\n/g, '\n');
        }

        expect(result).toEqual('Lorem ipsum...\n');
    });

    it('`readJSONFixture` works', function() {
        const result = readJSONFixture('utils-test');
        expect(result).toEqual({ 'utils-test': true });
    });
});
