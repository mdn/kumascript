/* jshint node: true, mocha: true, esversion: 6 */

var assert = require('chai').assert,
    tmp = require('tmp'),
    kumascript = require('..'),
    ks_loaders = kumascript.loaders,
    ks_test_utils = kumascript.test_utils,
    readTestFixture = ks_test_utils.readTestFixture;

describe('test-loaders', function () {

    it('Basic macro loading should work', function (done) {
        var loader = new ks_test_utils.JSONifyLoader(),
            data = ["test123", ["alpha", "beta", "gamma"]],
            expected = JSON.stringify(data);

        loader.get(data[0], function (err, tmpl) {
            if (err) {
                done(err);
            } else {
                assert.notEqual(typeof(tmpl), 'undefined');
                tmpl.execute(data[1], {}, function (err, result) {
                    if (!err) {
                        assert.equal(result, expected);
                    }
                    done(err);
                });
            }
        });
    });

    it('The BaseLoader cannot return the macros', function () {
        var loader = new ks_loaders.BaseLoader({}),
            data = loader.macros_data();
        assert.isNotOk(data.can_list_macros);
        assert.equal(0, data.macros.length);
    });

    it('The FileLoader can return the macros', function () {
        var loader = new ks_loaders.FileLoader({
                root_dir: 'tests/fixtures/templates'
            }),
            data = loader.macros_data(),
            macro_len = data.macros.length,
            cssxref_found = false;
        assert.isOk(data.can_list_macros);
        for (var i=0; i < macro_len; i++) {
            if (data.macros[i].name == 'cssxref') {
                cssxref_found = true;
                assert.equal('cssxref.ejs', data.macros[i].filename);
            }
        }
        assert.isTrue(cssxref_found, data.macros);
    });

    it('The FileLoader should detect no macros', function (done) {
        tmp.dir({template: '/tmp/tmp-XXXXXX'}, function (err, path) {
            if (!err) {
                assert.throws(
                    function() {
                        new ks_loaders.FileLoader({
                            root_dir: path
                        });
                    },
                    /no macros could be found in .+/
                );
            }
            done(err);
        });
    });

    it('The FileLoader should detect duplicate macros', function () {
        assert.throws(
            function() {
                new ks_loaders.FileLoader({
                    root_dir: 'tests/fixtures'
                });
            },
            /duplicate macros:[\s\S]+/
        );
    });

    it('The FileLoader should load macros', function (done) {
        var loader = new ks_loaders.FileLoader({
            root_dir: 'tests/fixtures/templates'
        });
        readTestFixture('templates/t1.ejs', done, function(expected) {
            loader.get('t1', function (err, tmpl) {
                if (!err) {
                    assert.equal(expected, tmpl.options.source);
                }
                done(err);
            });
        });
    });

    it('The FileLoader should load macros containing colons', function (done) {
        var loader = new ks_loaders.FileLoader({
                root_dir: 'tests/fixtures/templates'
            }),
            tmpl_fn = 'templates/template-exec-template.ejs';
        readTestFixture(tmpl_fn, done, function(expected) {
            loader.get('TemPlaTe:eXec:teMplatE', function (err, tmpl) {
                if (!err) {
                    assert.equal(expected, tmpl.options.source);
                }
                done(err);
            });
        });
    });
});
