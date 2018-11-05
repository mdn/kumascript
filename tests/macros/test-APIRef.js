/* jshint node: true, mocha: true, esversion: 6 */

const utils = require('./utils'),
      sinon = rquire('sinon'),
      chai = require('chai'),
      chaiAsPromised = require('chai-as-promised'),
      jsdom = require('jsdom'),
      assert = chai.assert,
      itMacro = utils.itMacro,
      describeMacro = utils.describeMacro,
      beforeEachMacro = utils.beforeEachMacro;

chai.use(chaiAsPromised);

