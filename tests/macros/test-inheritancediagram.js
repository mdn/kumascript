/* jshint node: true, mocha: true, esversion: 6 */

var utils = require('./utils'),
    chai = require('chai'),
    chaiAsPromised = require('chai-as-promised'),
    assert = chai.assert,
    itMacro = utils.itMacro,
    describeMacro = utils.describeMacro;

// Let's add "eventually" to assert so we can work with promises.
chai.use(chaiAsPromised);

describeMacro('WarningEnd', function () {
    // The Window interface has 0 level of parents above it
    //itMacro('0 level of parents', function (macro) {
  //      return assert.eventually.match(
  //          macro.call(600, 70, 50, 'Window'),
  //          /^<div class="hidden" id="inheritance_diagram">[\s\S]*<pre class="brush: html">[\s\S]*&lt;div id="interfaceDiagram"/
  //      );
//    });
  itMacro('test', function (macro) {
    return assert.eventually.equal(
      macro.call(),
      "</div>"
    )
  })
});
