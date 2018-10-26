/* jshint node: true, mocha: true, esversion: 6 */

const utils = require('./utils'),
      chai = require('chai'),
      jsdom = require('jsdom'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro;

const specStatusValues = [
    'REC',
    'PR',
    'CR',
    'RC',
    'WD',
    'ED',
    'Old-Transforms',
    'Living',
    'RFC',
    'Standard',
    'Draft',
    'Obsolete',
    'LC'
];

function checkSpecData(specDataJson) {
    const entries = Object.entries(specDataJson);
    for (let entry of entries) {
        assert(entry.name !== undefined, 'SpecData entry is missing required "name" property');
        assert(entry.url !== undefined, 'SpecData entry is missing required "url" property');
        assert(entry.status !== undefined, 'SpecData entry is missing required "status" property');

        assert(entry.url.startsWith('https://'), 'SpecData "url" entry is not an HTTPS URL');
        assert(specStatusValues.includes(entry.status), 'SpecData "status" entry is not a valid value');
    }
}

describeMacro('SpecData', function () {

    itMacro('Validate SpecData JSON', function (macro) {
        return macro.call().then(checkSpecData);
    });

});
