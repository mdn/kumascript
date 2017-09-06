/* jshint node: true, mocha: true, esversion: 6 */

var assert = require('chai').assert,
    kumascript = require('..'),
    ks_api = kumascript.api,
    ks_server = kumascript.server,
    ks_macros = kumascript.macros,
    ks_test_utils = kumascript.test_utils,
    testRequestExpected = ks_test_utils.testRequestExpected;

function getURL(uri) {
    return 'http://localhost:9000' + uri;
}

describe('test-api', function () {
    beforeEach(function() {
        this.test_server = ks_test_utils.createTestServer();
        this.macro_processor = new ks_macros.MacroProcessor({
            macro_timeout: 500,
            autorequire: {
                "test_api": "autorequire-lib1"
            },
            loader: {
                module: __dirname + '/../lib/kumascript/loaders',
                class_name: 'FileLoader',
                options: {
                    root_dir: "tests/fixtures/templates",
                }
            }
        });
        this.server = new ks_server.Server({
            port: 9000,
            logging: false,
            document_url_template: "http://localhost:9001/documents/{path}.txt",
            macro_processor: this.macro_processor
        });
        this.server.listen();
    });

    afterEach(function () {
        // Kill all the servers on teardown.
        this.server.close();
        this.test_server.close();
    });

    it('A template can include the output from another with template()', function (done) {
        testRequestExpected(
            getURL('/docs/template-exec'),
            'documents/template-exec-expected.txt',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    it('A template can import functions and data from another with require_macro()', function (done) {
        testRequestExpected(
            getURL('/docs/library-test'),
            'documents/library-test-expected.txt',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    it('A template can import an npm module with require()', function (done) {
        testRequestExpected(
            getURL('/docs/require-test'),
            'documents/require-test-expected.txt',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    it('The server can be configured to auto-require some templates', function (done) {
        testRequestExpected(
            getURL('/docs/autorequire'),
            'documents/autorequire-expected.txt',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    it('The API offers access to a cache for work done in templates', function (done) {
        // This is not an integration test for memcache. Instead, it just
        // ensures that the FakeMemcached stub gets used. If that works, then
        // the right calls should get made to memcached.
        testRequestExpected(
            getURL('/docs/memcache'),
            'documents/memcache-expected.txt',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    it('The API offers access to an RSS/Atom feed parser', function (done) {
        testRequestExpected(
            getURL('/docs/feeds'),
            'documents/feeds-expected.txt',
            done,
            function(resp, result, expected) {
                assert.equal(result.trim(), expected.trim());
            }
        );
    });

    describe('The API offers a function to build absolute API URLs', function () {
        const test_path = 'en-US/docs/<Web>?look=fancy&font=big#note';
        beforeEach(function() {
            this.doc_base_url = 'https://api:8000';
            this.api = new ks_api.APIContext({
                doc_base_url: this.doc_base_url
            });
        });
        it('test with falsy paths', function () {
            assert.equal(this.api.build_api_url(), this.doc_base_url);
            assert.equal(this.api.build_api_url(''), this.doc_base_url);
            assert.equal(this.api.build_api_url(null), this.doc_base_url);
            assert.equal(this.api.build_api_url(undefined), this.doc_base_url);
        });
        it('test with "/"', function () {
            assert.equal(this.api.build_api_url('/'), this.doc_base_url + '/');
        });
        [
            test_path,
            '/' + test_path,
            'http://localhost:8000/' + test_path
        ].forEach(function (path) {
            it(`test with "${path}"`, function () {
                assert.equal(
                    this.api.build_api_url(path),
                    this.doc_base_url + '/' +  encodeURI(test_path)
                );
            });
        });
    });
});
