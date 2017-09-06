/* jshint node: true, mocha: true, esversion: 6 */

var assert = require('chai').assert,
    kumascript = require('..'),
    ks_templates = kumascript.templates;

// Main test case starts here
describe('test-templates', function () {
    it('Embedded JS templates should work', function (done) {
        var tmpl = new ks_templates.EJSTemplate({
            source: '<%= one + two %>'
        });
        tmpl.execute([], {one: 1, two: 2}, function (err, result) {
            if (!err) {
                assert.equal('3', result);
            }
            done(err);
        });
    });
});
