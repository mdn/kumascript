/* jshint node: true, mocha: true, esversion: 6 */

var _ = require('underscore'),
    async = require('async'),
    request = require('request'),
    assert = require('chai').assert,
    kumascript = require('..'),
    ks_utils = kumascript.utils,
    ks_caching = kumascript.caching,
    ks_test_utils = kumascript.test_utils,
    testRequest = ks_test_utils.testRequest,
    TEST_BASE_URL = 'http://localhost:9001',
    TEST_ETAG = '8675309JENNY',
    // Let's throw some utf-8 torture through the pipes
    TEST_CONTENT = "Community Communauté Сообщество コミュニティ 커뮤니티";

describe('test-caching', function () {
    beforeEach(function () {
        this.app = ks_test_utils.createTestServer();
        this.cache = new ks_caching.ResponseCache({});
    });

    afterEach(function () {
        this.app.close();
    });

    it('Caching request should send headers from options, regardless of Cache-Control option', function (done) {
        var endpoint = '/headers-echo',
            cases = [null, 'no-cache', 'max-age=0'],
            expected_headers = {'X-Foo': 'BarBaz', 'X-Quux': 'Xyzzy'};

        // Define the endpoint.
        this.app.get(endpoint, function (req, res) {
            res.send(JSON.stringify(req.headers));
        });

        async.forEach(cases, function (cache_control, fe_next) {
            var opts = {
                memcached: new ks_utils.FakeMemcached(),
                timeout: 500,
                url: TEST_BASE_URL + endpoint,
                headers: _.clone(expected_headers)
            };
            if (cache_control) {
                opts.cache_control = cache_control;
            }
            ks_caching.request(opts, function (err, resp, body, cache_hit) {
                if (!err) {
                    var result_headers = JSON.parse(body);
                    _.each(expected_headers, function (v, k) {
                        var lk = k.toLowerCase();
                        assert.isTrue(lk in result_headers);
                        assert.equal(v, result_headers[lk]);
                    });
                    if (cache_control) {
                        assert.equal(cache_control,
                                     result_headers['cache-control']);
                    }
                }
                fe_next(err);
            });
        }, done);
    });

    it('Should use Last-Modified from cached response if available', function (done) {
        var $this = this;
        var expected_modified = 'Wed, 14 Mar 2002 15:48:09 GMT';
        $this.app.get('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.set('Last-Modified', expected_modified);
                res.send(TEST_CONTENT);
            });
        });
        testRequest(TEST_BASE_URL + '/test1', done, function (res, content) {
            assert.equal(res.headers['last-modified'], expected_modified);
        });
    });

    it('Should supply Last-Modified if none available', function (done) {
        var $this = this;
        $this.app.get('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });
        testRequest(TEST_BASE_URL + '/test1', done, function (res, content) {
            assert.isTrue('last-modified' in res.headers);
        });
    });

    it('Should use ETag from cached response if available', function (done) {
        var $this = this;
        $this.app.get('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.set('ETag', TEST_ETAG);
                res.send(TEST_CONTENT);
            });
        });
        testRequest(TEST_BASE_URL + '/test1', done, function (res, content) {
            assert.equal(res.headers.etag, TEST_ETAG);
        });
    });

    it('Should support conditional GET with If-Modified-Since', function (done) {
        var $this = this;
        $this.app.get('/test1', function (req, res) {
            var opts = {};
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });
        async.waterfall([
            function (wf_next) {
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    if (err) {
                        wf_next(err);
                    } else {
                        wf_next(null, res.headers['last-modified']);
                    }
                });
            }, function (modified, wf_next) {
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "If-Modified-Since": modified }
                };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 304);
                });
            }
        ], done);
    });

    it('Should support conditional GET with If-None-Match', function (done) {
        var $this = this;
        $this.app.get('/test1', function (req, res) {
            var opts = {};
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.set('ETag', TEST_ETAG);
                res.send(TEST_CONTENT);
            });
        });
        async.waterfall([
            function (wf_next) {
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    if (err) {
                        wf_next(err);
                    } else {
                        wf_next(null, res.headers.etag);
                    }
                });
            }, function (etag, wf_next) {
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "If-None-Match": etag }
                };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 304);
                });
            }
        ], done);
    });

    it('Should honor max-age = 0 with shortcircuit', function (done) {
        var $this = this;
        $this.app.get('/test1', function (req, res) {
            var opts = {};
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });
        async.waterfall([
            function (wf_next) {
                // Initial request
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    wf_next(err);
                });
            }, function (wf_next) {
                // First GET, should be cached and Age: header is evidence.
                testRequest(TEST_BASE_URL + '/test1', wf_next, function (res, content) {
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers['x-cache'], 'HIT');
                    assert.isTrue('age' in res.headers);
                });
            }, function (wf_next) {
                // Second GET, should be a miss
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "Cache-Control": "max-age=0" }
                };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 200);
                    assert.notEqual(res.headers['x-cache'], 'HIT');
                    assert.isTrue(! ('age' in res.headers) );
                });
            }
        ], done);
    });

    it('Should honor max-age > 0', function (done) {
        // This test takes longer than the default 2000ms timeout.
        this.timeout(3000);

        var $this = this;
        $this.app.get('/test1', function (req, res) {
            var opts = {};
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });
        async.waterfall([
            function (wf_next) {
                // Initial request
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    wf_next(err);
                });
            }, function (wf_next) {
                // Wait a second...
                setTimeout(wf_next, 1000);
            }, function (wf_next) {
                // First GET, should be cached and Age: header is evidence.
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "Cache-Control": "max-age=30" }
                };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers['x-cache'], 'HIT');
                    assert.isTrue('age' in res.headers);
                    assert.isTrue(res.headers.age < 30);
                });
            }, function (wf_next) {
                // Wait a second...
                setTimeout(wf_next, 1000);
            }, function (wf_next) {
                // Second GET, should be a miss
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "Cache-Control": "max-age=1" }
                };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 200);
                    assert.notEqual(res.headers['x-cache'], 'HIT');
                    assert.isTrue(! ('age' in res.headers) );
                });
            }
        ], done);
    });

    it('Should honor no-cache', function (done) {
        var $this = this;
        $this.app.get('/test1', function (req, res) {
            var opts = {};
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });
        async.waterfall([
            function (wf_next) {
                // Initial request
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    wf_next(err);
                });
            }, function (wf_next) {
                // Wait a second...
                setTimeout(wf_next, 1000);
            }, function (wf_next) {
                // Second GET, should be cached and Age: header is evidence.
                testRequest(TEST_BASE_URL + '/test1', wf_next,
                    function (res, content) {
                        assert.equal(res.statusCode, 200);
                        assert.equal(res.headers['x-cache'], 'HIT');
                        assert.isTrue('age' in res.headers);
                        assert.isTrue(res.headers.age < 30);
                    }
                );
            }, function (wf_next) {
                // Third GET, should be a miss
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "Cache-Control": "no-cache" }
                };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 200);
                    assert.notEqual(res.headers['x-cache'], 'HIT');
                    assert.isTrue(! ('age' in res.headers) );
                });
            }
        ], done);
    });

    it('Should not cache a response with a status other than 200 OK', function (done) {
        var $this = this,
            req_cnt = 0,
            url = TEST_BASE_URL + '/test1',
            bad_etag = 'IGNORE THIS',
            bad_content = 'THIS SHOULD NOT BE CACHED';

        $this.app.get('/test1', function (req, res) {
            var opts = {};
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                if (req_cnt === 0) {
                    res.set('ETag', bad_etag);
                    res.status(404).send(bad_content);
                } else {
                    res.set('ETag', TEST_ETAG);
                    res.status(200).send(TEST_CONTENT);
                }
                req_cnt++;
            });
        });

        async.waterfall([
            function (wf_next) {
                request(url, function (err, res, content) {
                    if (err) {
                        wf_next(err);
                    } else {
                        assert.equal(res.statusCode, 404);
                        wf_next(null, res.headers.etag);
                    }
                });
            }, function (etag, wf_next) {
                var opts = {
                    url: url,
                    headers: { "If-None-Match": etag }
                };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 200);
                    assert.equal(content, TEST_CONTENT);
                });
            }
        ], done);
    });

    it('Should not cache a response for methods other than GET or HEAD', function (done) {
        var $this = this,
            url = TEST_BASE_URL + '/test1',
            post_ct = 'POST CONTENT',
            post_etag = 'POST ETAG';

        $this.app.get('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.set('ETag', TEST_ETAG);
                res.send(TEST_CONTENT);
            });
        });
        $this.app.post('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.set('ETag', post_etag);
                res.send(post_ct);
            });
        });

        async.waterfall([
            function (wf_next) {
                var opts = { url: url, method: 'POST' };
                request(opts, function (err, res, content) {
                    if (err) {
                        wf_next(err);
                    } else {
                        assert.equal(res.statusCode, 200);
                        wf_next(null, res.headers.etag);
                    }
                });
            }, function (etag, wf_next) {
                var opts = { url: url, method: 'GET',
                             headers: { "If-None-Match": etag } };
                request(opts, function (err, res, content) {
                    if (err) {
                        wf_next(err);
                    } else {
                        assert.equal(res.statusCode, 200);
                        assert.equal(content, TEST_CONTENT);
                        wf_next(null, res.headers.etag);
                    }
                });
            }, function (etag, wf_next) {
                var opts = { url: url, method: 'HEAD',
                                 headers: { "If-None-Match": etag } };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 304);
                    assert.equal(content.length, 0);
                });
            }, function (wf_next) {
                var opts = { url: url, method: 'HEAD' };
                testRequest(opts, wf_next, function (res, content) {
                    assert.equal(res.statusCode, 200);
                    assert.equal(res.headers['x-cache'], 'HIT');
                    assert.equal(content.length, 0);
                });
            }
        ], done);
    });

    it('Cache internals should support some HTTP caching semantics', function (done) {

        var test_key = "/docs/en-US/testdoc",
            expected_content = "THIS IS A TEST",
            expected_etag= "8675309JENNY",
            now = (new Date()).getTime(),
            then_age = 600,
            then = now - (then_age * 1000),
            ancient_age = 86400,
            ancient = now - (ancient_age * 1000),
            cache = new ks_caching.ResponseCache(),
            content_etag = null;

        // In the arguments to the callback for the cache.get calls below,
        // remember that the value of "err" is actually the status of the get
        // operation like "MISS", "STALE", "NOT_MODIFIED" or null, and not
        // an actual exception or error.

        async.waterfall([
            function (wf_next) {
                // Set the cache content.
                var opts = {
                    last_modified: then,
                    etag: expected_etag
                };
                cache.set(test_key, 3600, null, expected_content, opts,
                    function (err, headers, content, meta) {
                        if (!err) {
                            assert.equal(meta.last_modified, opts.last_modified);
                            assert.equal(meta.etag, expected_etag);
                            content_etag = meta.etag;
                        }
                        wf_next(err);
                    });
            }, function (wf_next) {
                // Try a get for something not found
                var opts = {};
                cache.get("/lol/wut", opts, function (err, headers, content, meta) {
                    assert.equal(err, cache.ERR_MISS);
                    assert.equal(content, null);
                    wf_next();
                });
            }, function (wf_next) {
                // Try an unconditional get
                var opts = {};
                cache.get(test_key, opts, function (err, headers, content, meta) {
                    assert.equal(content, expected_content);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a max_age condition that should pass
                var opts = { max_age: ancient_age };
                cache.get(test_key, opts, function (err, headers, content, meta) {
                    assert.equal(err, null);
                    assert.equal(content, expected_content);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a max_age of 0
                var opts = { max_age: 0 };
                cache.get(test_key, opts, function (err, headers, content, meta) {
                    assert.equal(err, cache.ERR_MISS);
                    assert.equal(content, null);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a max_age condition that should fail
                var opts = { max_age: (then_age / 2) };
                cache.get(test_key, opts, function (err, headers, content, meta) {
                    assert.equal(err, cache.ERR_STALE);
                    assert.equal(content, null);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a if_none_match condition that should pass
                var opts = { if_none_match: "BADHASH" };
                cache.get(test_key, opts, function (err, headers, content, meta) {
                    assert.equal(err, null);
                    assert.equal(content, expected_content);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a if_none_match condition that should fail
                var opts = { if_none_match: content_etag };
                cache.get(test_key, opts, function (err, headers, content, meta) {
                    assert.equal(err, cache.ERR_NOT_MODIFIED);
                    assert.equal(content, null);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a if_modified_since condition that should pass
                var opts = { if_modified_since: ancient };
                cache.get(test_key, opts, function (err, headers, content, meta) {
                    assert.equal(err, null);
                    assert.equal(content, expected_content);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a if_modified_since condition that should fail
                var opts = { if_modified_since: now - (then_age/2) };
                cache.get(test_key, opts, function (err, headers, content, meta) {
                    assert.equal(err, cache.ERR_NOT_MODIFIED);
                    assert.equal(content, null);
                    wf_next();
                });
            }
        ], done);
    });

    it("If a 304 is returned but the body content isn't in cache, force a 200 from kuma", function (done) {

        // Step 1:  do a test request for content, cache it (200)
        // Step 2:  do a test request that returns a 304, ensure the last_mod is future
        // Step 3:  remove the body from memcache *directly*
        // Step 4:  make a request that would otherwise trigger 304 but since the body is gone, last_mod is set to 0
        // Step 5:  ensure the next request is a 304 and cache has body

        var $this = this,
            url = TEST_BASE_URL + '/test1',
            cache = new ks_utils.FakeMemcached();

        // Key generated the same as within caching.js
        function key(opts, name) {
            var base_key = 'kumascript:request:' + ks_utils.md5(opts.url);
            return base_key + ':' + name;
        }

        // Step 1
        $this.app.get('/test1', function (req, res) {
            var opts = getOptions();
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });

        // The same URL and cache object will be used throughout the tests
        // Need to keep returning new object to headers aren't applied to it from re-use
        function getOptions() {
            return {
                url: url,
                memcached: cache
            };
        }

        // In the arguments to the callback for the cache.get calls below,
        // remember that the value of "err" is actually the status of the get
        // operation like "MISS", "STALE", "NOT_MODIFIED" or null, and not
        // an actual exception or error.

        async.waterfall([
            function (wf_next) { // Step 2:  Part 1
                var opts = getOptions();
                ks_caching.request(opts, function (err, res, content) {
                    if (!err) {
                        assert.equal(res.statusCode, 200);
                    }
                    wf_next(err);
                });
            }, function (wf_next) {  // Step 2:  Part 2
                var opts = getOptions();
                ks_caching.request(opts, function (err, res, content) {
                    if (err) {
                        wf_next(err);
                    } else {
                        assert.equal(res.statusCode, 304);
                        assert.isOk(res.req._headers['if-modified-since'],
                                    'A "if-modified-since" is set for the cached document request');
                        cache.get(key(opts, 'body'), function(err, res) {
                            assert.isTrue(res !== undefined,
                                         'Content is properly stored in cache');
                            wf_next();
                        });
                    }
                });
            }, function (wf_next) { // Step 3
                var opts = getOptions();
                cache.remove(key(opts, 'body'), function() {
                    cache.get(key(opts, 'body'), function(err, res) {
                        assert.isTrue(res === undefined,
                                      'Content removed from fake cache');
                        wf_next();
                    });
                });
            }, function (wf_next) { // Step 4
                var opts = getOptions();
                ks_caching.request(opts, function (err, res, content) {
                    if (!err) {
                        assert.isTrue(res.req._headers['if-modified-since'] === undefined,
                                      'A "if-modified-since" is *not* set for the document request');
                        assert.equal(res.statusCode, 200);
                    }
                    wf_next(err);
                });
            }, function (wf_next) { // Step 5
                var opts = getOptions();
                ks_caching.request(opts, function (err, res, content) {
                    if (err) {
                        wf_next(err);
                    } else {
                        assert.equal(res.statusCode, 304);
                        assert.isOk(res.req._headers['if-modified-since'],
                                    'A "if-modified-since" is set again for the document request');
                        cache.get(key(opts, 'body'), function(err, res) {
                            assert.isTrue(res !== undefined,
                                          'Content is properly stored in cache');
                            wf_next();
                        });
                    }
                });
            }
        ], done);
    });
});
