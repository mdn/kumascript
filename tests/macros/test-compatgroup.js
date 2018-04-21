/* jshint node: true, mocha: true, esversion: 6 */

// Get necessary modules
const sinon = require('sinon');
const { itMacro, describeMacro, beforeEachMacro } = require('./utils');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');

const  fixture_dir = path.resolve(__dirname, 'fixtures/compatgroup');
const { JSDOM } = jsdom;

// Let's add 'eventually' to assert so we can work with promises.
chai.use(chaiAsPromised);

// Load test data: test properties.json and test bcd
const bcdTestData = JSON.parse(fs.readFileSync(path.resolve(fixture_dir, 'bcd.json'), 'utf8'));
const propertiesTestData = JSON.parse(fs.readFileSync(path.resolve(fixture_dir, 'properties.json'), 'utf8'));

describeMacro('CompatGroup', function () {

    beforeEachMacro(function (macro) {
        // Stub BCD and properties.json to return our test data
        macro.ctx.require = sinon.stub();
        macro.ctx.require.withArgs('mdn-browser-compat-data').returns(bcdTestData);
        macro.ctx.mdn.fetchJSONResource = sinon.stub();
        macro.ctx.mdn.fetchJSONResource.returns(propertiesTestData);
    });

    itMacro('Test a group that has properties in both datasets', function (macro) {
        return macro.call('Test Group').then(function(result) {
            let dom = JSDOM.fragment(result);
            let rows = dom.querySelectorAll('tbody>tr');
            // assert that the compat table contains 2 rows
            chai.assert.equal(rows.length, 2);
            // assert that both rows have the expected property
            let th1 = rows[0].querySelector("th").textContent;
            chai.assert.equal(th1, 'test-property-one');
            let th2 = rows[1].querySelector("th").textContent;
            chai.assert.equal(th2, 'test-property-three');
        });
    });

    itMacro('Test a group that has no properties in properties.json', function (macro) {
        return macro.call('Test Nonexistent Group').then(function(result) {
            let expected = 'No compatibility data found. Please contribute data for "Test Nonexistent Group" (depth: 1) to the <a href="https://github.com/mdn/browser-compat-data">MDN compatibility data repository</a>.';
            chai.assert.equal(result, expected);
        });
    });

    itMacro('Test a group that has no properties in bcd.json', function (macro) {
        return macro.call('Test Group Not In BCD').then(function(result) {
            let expected = 'No compatibility data found. Please contribute data for "Test Group Not In BCD" (depth: 1) to the <a href="https://github.com/mdn/browser-compat-data">MDN compatibility data repository</a>.';
            chai.assert.equal(result, expected);
        });
    });

});
