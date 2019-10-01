/**
 * @prettier
 */
const { assert, itMacro, describeMacro } = require('./utils');

describeMacro('EmbedTest262ReportResultsTable', function() {
    itMacro('Feature Tag: No non-alphabet characters', function(macro) {
        return assert.eventually.equal(
            macro.call('BigInt'),
            '<iframe frameborder="0" scrolling="no" style="width: 100%; height: 300px;"' +
            ' src="https://test262.report/embed/features/BigInt?engines=chakra%2Cjavascriptcore%2Cspidermonkey%2Cv8&summary=true&include-browsers=true"></iframe>'
        );
    });
    itMacro('Feature Tag: Has a "."', function(macro) {
        return assert.eventually.equal(
            macro.call('Object.fromEntries'),
            '<iframe frameborder="0" scrolling="no" style="width: 100%; height: 300px;"' +
            ' src="https://test262.report/embed/features/Object.fromEntries?engines=chakra%2Cjavascriptcore%2Cspidermonkey%2Cv8&summary=true&include-browsers=true"></iframe>'
        );
    });
    itMacro('Feature Tag: Has a "-"', function(macro) {
        return assert.eventually.equal(
            macro.call('dynamic-import'),
            '<iframe frameborder="0" scrolling="no" style="width: 100%; height: 300px;"' +
            ' src="https://test262.report/embed/features/dynamic-import?engines=chakra%2Cjavascriptcore%2Cspidermonkey%2Cv8&summary=true&include-browsers=true"></iframe>'
        );
    });
});
