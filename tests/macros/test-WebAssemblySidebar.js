/* jshint node: true, mocha: true, esversion: 6 */

var sinon = require('sinon'),
    utils = require('./utils'),
    chai = require('chai'),
    chaiAsPromised = require('chai-as-promised'),
    assert = chai.assert,
    itMacro = utils.itMacro,
    describeMacro = utils.describeMacro,
    beforeEachMacro = utils.beforeEachMacro;
chai.use(chaiAsPromised);

var expected = `\
<section class="Quick_links" id="Quick_Links">

<ol>
  <li data-default-state="open"><a href="/en-US/docs/WebAssembly"><strong>WebAssembly home page</strong></a>
  <li class="toggle">
    <details open>
      <summary>Tutorials</summary>
      <ol>
        <li><a href="/en-US/docs/WebAssembly/Concepts">WebAssembly concepts</a></li>
        <li><a href="/en-US/docs/WebAssembly/C_to_wasm">Compiling from C/C++ to WebAssembly</a></li>
        <li><a href="/en-US/docs/WebAssembly/Rust_to_wasm">Compiling from Rust to WebAssembly</a></li>
        <li><a href="/en-US/docs/WebAssembly/Using_the_JavaScript_API">Using the WebAssembly JavaScript API</a></li>
        <li><a href="/en-US/docs/WebAssembly/Understanding_the_text_format">Understanding WebAssembly text format</a></li>
        <li><a href="/en-US/docs/WebAssembly/Text_format_to_wasm">Converting WebAssembly text format to wasm</a></li>
        <li><a href="/en-US/docs/WebAssembly/Loading_and_running">Loading and running WebAssembly code</a></li>
        <li><a href="/en-US/docs/WebAssembly/Caching_modules">Caching compiled WebAssembly modules</a></li>
        <li><a href="/en-US/docs/WebAssembly/Exported_functions">Exported WebAssembly functions</a></li>
      </ol>
    </details>
  </li>
  <li class="toggle">
    <details open>
      <summary>Object reference</summary>
      <ol>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly" title="Title for WebAssembly"><code>WebAssembly</code></a></li>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Module" title="Title for WebAssembly.Module"><code>WebAssembly.Module</code></a></li>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Global" title="Title for WebAssembly.Global"><code>WebAssembly.Global</code></a></li>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Instance" title="Title for WebAssembly.Instance"><code>WebAssembly.Instance</code></a></li>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Memory" title="Title for WebAssembly.Memory"><code>WebAssembly.Memory</code></a></li>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/Table" title="Title for WebAssembly.Table"><code>WebAssembly.Table</code></a></li>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/CompileError" title="Title for WebAssembly.CompileError"><code>WebAssembly.CompileError</code></a></li>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/LinkError" title="Title for WebAssembly.LinkError"><code>WebAssembly.LinkError</code></a></li>
        <li><a href="/en-US/docs/Web/JavaScript/Reference/Global_Objects/WebAssembly/RuntimeError" title="Title for WebAssembly.RuntimeError"><code>WebAssembly.RuntimeError</code></a></li>
      </ol>
    </details>
  </li>
</ol>

</section>`;


describeMacro('WebAssemblySidebar', function () {
    beforeEachMacro(function (macro) {
        // Mock calls to template("jsxref", [partialSlug])
        var endpoints = [
                'WebAssembly',
                'WebAssembly.Module',
                'WebAssembly.Global',
                'WebAssembly.Instance',
                'WebAssembly.Memory',
                'WebAssembly.Table',
                'WebAssembly.CompileError',
                'WebAssembly.LinkError',
                'WebAssembly.RuntimeError'],
            baseURL = '/en-US/docs/Web/JavaScript/Reference/Global_Objects/';

        macro.ctx.template = sinon.stub();
        for (let jsSlug of endpoints) {
            var partialSlug = jsSlug.replace('.', '/'),
                url = baseURL + partialSlug;
            macro.ctx.template.withArgs('jsxref', [jsSlug]).returns(
                '<a href="' + url + '" title="Title for ' + jsSlug + '">' +
                '<code>' + jsSlug + '</code></a>');
        }
    });

    itMacro('Generates WebAssembly Sidebar', function (macro) {
        return assert.eventually.equal(macro.call(), expected);
    });
});
