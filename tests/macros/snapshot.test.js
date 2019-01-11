/**
 * This is a dumb test that renders macros and compares their output
 * to the expected output recorded in snapshots.json. It is completely
 * brittle: the smallest change to the .ejs file will cause a test
 * failure, and you'll have to update the test to match.
 *
 * Alternatively, you can write a real test for any macro you change
 * and then run `node create-snapshots.js` to regenerate the snapshots.json
 * file. We only generate snapshots for macros that do not have their own
 * macro.test.js test, so if you write a real test for a macro you won't
 * have to deal with the brittle snapshot test.
 *
 * These are far from perfect. Many of the macros have complex behaviors
 * and do not produce reasonable snapshots when we render them in this
 * fake way. Other macros don't render at all and just throw errors when
 * we try to make a snapshot of them. Those macros are excluded from
 * the snapshots.json file so they are not tested by this test.
 *
 * I think the system is better than nothing, however, since it
 * may catch accidental changes to macros or to the api that they use.
 *
 * The snapshotting code is in snapshot.js. It includes a Proxy-based
 * JSON mock that creates an object that attempts to behave like a blob
 * of JSON data without having any knowledge of what properties are expected.
 *
 * The create-snapshot.js file regenerates snapshots.json. You'll want to
 * run it when you have made intentional changes to a macro and you're
 * confident that the new output is correct. Check in your changes to
 * snapshots.json when you regenerate it.
 *
 * @prettier
 */
const fs = require('fs');
const snapshot = require('./snapshot.js');

let snapshots = JSON.parse(
    fs.readFileSync(__dirname + '/snapshots.json', 'utf-8')
);

describe('snapshot tests for macros without explicit tests', () => {
    for (let macroName of Object.keys(snapshots)) {
        describe(`${macroName}`, () => {
            let cases = snapshots[macroName].map(s => [
                JSON.stringify(s.input),
                s.input,
                s.output
            ]);

            it.each(cases)('for input %s', async (_, input, output) => {
                expect(await snapshot(macroName, input)).toEqual(output);
            });
        });
    }
});
