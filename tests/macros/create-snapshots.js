/**
 * @prettier
 */
/* eslint-disable no-console */

const fs = require('fs');
const Templates = require('../../src/templates.js');
const snapshot = require('./snapshot.js');

// Get a list of the existing tests in this directoy
let macrosWithTests = new Set(
    fs
        .readdirSync(__dirname)
        .filter(fn => fn.endsWith('.test.js'))
        .map(fn => fn.slice(0, -8).toLowerCase())
);

// These are special cases macros that we can't do snapshot testing on.
// For learnbox and tenthcampaign quote, they have random output so
// snapshots do not work.
let doNotTest = new Set(['learnbox', 'tenthcampaignquote']);

// Get a list of all the macros and then figure out which
// ones need snapshot tests.
let macrosToTest = [];
let templates = new Templates(__dirname + '/../../macros/');
for(let [name, path] of templates.getTemplateMap().entries()) {
    // if the macro is a json file, we don't want a snapshot test
    if (path.endsWith(".json")) continue;

    // If the macro is a Sidebar, we don't want a snapshot test
    // because sidebar macros change too often
    if (path.endsWith("Sidebar.ejs")) continue;

    // If there is already a real test for this macro then we
    // don't want a snapshot test either.
    if (macrosWithTests.has(name)) continue;

    // Don't test the special cases either.
    if (doNotTest.has(name)) continue;

    // Otherwise, we want to generate a snapshot for this macros
    macrosToTest.push(name);
}

macrosToTest.sort();

const INPUTS = [[], ['a1', 'a2', 'a3', 'a4']];

async function createSnapshots() {
    let macroSnapshots = {};

    for (let macroname of macrosToTest) {
        // Two macros produce random output and can't be tested this way
        // So just skip over them.
        if (macroname === 'learnbox' || macroname === 'tenthcampaignquote') {
            continue;
        }

        console.log(macroname);
        let snapshots = [];
        macroSnapshots[macroname] = snapshots;
        let lastOutput = null;

        for (let input of INPUTS) {
            try {
                let output = await snapshot(macroname, input);
                // If the output doesn't change with the input
                // then don't both recording an additional snapshot
                if (output !== lastOutput) {
                    lastOutput = output;
                    snapshots.push({ input, output });
                }
            } catch (e) {
                console.log('Error creating snapshot for', macroname);
            }
        }
    }

    return macroSnapshots;
}

if (process.argv.length === 2) {
    createSnapshots().then(snapshots => {
        fs.writeFileSync(
            __dirname + '/snapshots.json',
            JSON.stringify(snapshots, null, 2)
        );
    });
} else {
    let macroName = process.argv[2];
    let args = process.argv.slice(3);
    snapshot(macroName, args)
        .then(result => console.log(result))
        .catch(e => console.error(e));
}
