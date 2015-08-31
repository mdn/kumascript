/*jshint node: true, expr: false, boss: true */

var util = require('util'),
    fs = require('fs'),
    crypto = require('crypto'),

    _ = require('underscore'),
    async = require('async'),
    nodeunit = require('nodeunit'),
    express = require('express'),
    request = require('request'),

    kumascript = require('..'),
    ks_utils = kumascript.utils,
    ks_caching = kumascript.caching,
    ks_test_utils = kumascript.test_utils;

var TEST_PORT = 9001;
var TEST_BASE_URL = 'http://localhost:' + TEST_PORT;

var TEST_ETAG = '8675309JENNY';
// Let's throw some utf-8 torture through the pipes
var TEST_CONTENT = "Community Communauté Сообщество コミュニティ 커뮤니티";

module.exports = nodeunit.testCase({

    setUp: function (next) {
        var $this = this;
        $this.app = ks_test_utils.createTestServer();
        $this.cache = new ks_caching.ResponseCache({ });
        next();
    },

    tearDown: function (next) {
        var $this = this;
        $this.app._kumascript_listener.close();
        next();
    },

    "Caching request should send headers from options, regardless of Cache-Control option": function (test) {
        var $this = this;
        var cases = [null, 'no-cache', 'max-age=0'];
        async.forEach(cases, function (cache_control, fe_next) {

            var expected_headers = {
                'X-Foo': 'BarBaz',
                'X-Quux': 'Xyzzy'
            };
            var endpoint = '/headers-echo';
            $this.app.get(endpoint, function (req, res) {
                var out = JSON.stringify(req.headers);
                res.send(out);
            });
            var opts = {
                memcached: new ks_utils.FakeMemcached(),
                timeout: 500,
                url: TEST_BASE_URL + endpoint,
                headers: _(expected_headers).clone()
            };
            if (cache_control) {
                opts['cache_control'] = cache_control;
            }
            ks_caching.request(opts, function (err, resp, body, cache_hit) {
                var result_headers = JSON.parse(body);
                _(expected_headers).each(function (v, k) {
                    var lk = k.toLowerCase();
                    test.ok(lk in result_headers);
                    test.equal(v, result_headers[lk]);
                });
                if (cache_control) {
                    test.equal(cache_control, result_headers['cache-control']);
                }
                fe_next();
            });

        }, function (err) {
            test.done();
        });
    },

    "Should use Last-Modified from cached response if available": function (test) {
        var $this = this;
        var expected_modified = 'Wed, 14 Mar 2002 15:48:09 GMT';
        $this.app.get('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.header('Last-Modified', expected_modified);
                res.send(TEST_CONTENT);
            });
        });
        request(TEST_BASE_URL + '/test1', function (err, res, content) {
            test.equal(res.headers['last-modified'], expected_modified);
            test.done();
        });
    },

    "Should supply Last-Modified if none available": function (test) {
        var $this = this;
        $this.app.get('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });
        request(TEST_BASE_URL + '/test1', function (err, res, content) {
            test.ok('last-modified' in res.headers);
            test.done();
        });
    },

    "Should use ETag from cached response if available": function (test) {
        var $this = this;
        $this.app.get('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.header('ETag', TEST_ETAG);
                res.send(TEST_CONTENT);
            });
        });
        request(TEST_BASE_URL + '/test1', function (err, res, content) {
            test.equal(res.headers.etag, TEST_ETAG);
            test.done();
        });
    },

    "Should support conditional GET with If-Modified-Since": function (test) {
        var $this = this;
        
        $this.app.get('/test1', function (req, res) {
            var opts = { };
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });

        async.waterfall([
            function (wf_next) {
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    wf_next(null, res.headers['last-modified']);
                });
            }, function (modified, wf_next) {
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "If-Modified-Since": modified }
                };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 304);
                    wf_next();
                });
            }
        ], function () {
            test.done();
        });
    },

    "Should support conditional GET with If-None-Match": function (test) {
        var $this = this;
        
        $this.app.get('/test1', function (req, res) {
            var opts = { };
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.header('ETag', TEST_ETAG);
                res.send(TEST_CONTENT);
            });
        });

        async.waterfall([
            function (wf_next) {
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    wf_next(null, res.headers.etag);
                });
            }, function (etag, wf_next) {
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "If-None-Match": etag }
                };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 304);
                    wf_next();
                });
            }
        ], function () {
            test.done();
        });
    },

    "Should honor max-age = 0 with shortcircuit": function (test) {
        var $this = this;
        
        $this.app.get('/test1', function (req, res) {
            var opts = { };
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });

        async.waterfall([
            function (wf_next) {
                // Initial request
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    wf_next();
                });
            }, function (wf_next) {
                // First GET, should be cached and Age: header is evidence.
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.equal(res.headers['x-cache'], 'HIT');
                    test.ok('age' in res.headers);
                    wf_next();
                });
            }, function (wf_next) {
                // Second GET, should be a miss
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "Cache-Control": "max-age=0" }
                };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.notEqual(res.headers['x-cache'], 'HIT');
                    test.ok(! ('age' in res.headers) );
                    wf_next();
                });
            }
        ], function () {
            test.done();
        });
    },

    "Should honor max-age > 0": function (test) {
        var $this = this;
        
        $this.app.get('/test1', function (req, res) {
            var opts = { };
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });

        async.waterfall([
            function (wf_next) {
                // Initial request
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    wf_next();
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
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.equal(res.headers['x-cache'], 'HIT');
                    test.ok('age' in res.headers);
                    test.ok(res.headers.age < 30);
                    wf_next();
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
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.notEqual(res.headers['x-cache'], 'HIT');
                    test.ok(! ('age' in res.headers) );
                    wf_next();
                });
            }
        ], function () {
            test.done();
        });
    },

    "Should honor no-cache": function (test) {
        var $this = this;
        
        $this.app.get('/test1', function (req, res) {
            var opts = { };
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                res.send(TEST_CONTENT);
            });
        });

        async.waterfall([
            function (wf_next) {
                // Initial request
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    wf_next();
                });
            }, function (wf_next) {
                // Wait a second...
                setTimeout(wf_next, 1000);
            }, function (wf_next) {
                // Second GET, should be cached and Age: header is evidence.
                request(TEST_BASE_URL + '/test1', function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.equal(res.headers['x-cache'], 'HIT');
                    test.ok('age' in res.headers);
                    test.ok(res.headers.age < 30);
                    wf_next();
                });
            }, function (wf_next) {
                // Third GET, should be a miss
                var opts = {
                    url: TEST_BASE_URL + '/test1',
                    headers: { "Cache-Control": "no-cache" }
                };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.notEqual(res.headers['x-cache'], 'HIT');
                    test.ok(! ('age' in res.headers) );
                    wf_next();
                });
            }
        ], function () {
            test.done();
        });
    },

    "Should not cache a response with a status other than 200 OK": function (test) {
        var $this = this;

        var req_cnt = 0,
            url = TEST_BASE_URL + '/test1',
            bad_etag = 'IGNORE THIS',
            bad_content = 'THIS SHOULD NOT BE CACHED';

        $this.app.get('/test1', function (req, res) {
            var opts = { };
            $this.cache.cacheResponse(req, res, opts, function (req, res) {
                if (req_cnt === 0) {
                    res.header('ETag', bad_etag);
                    res.status(404).send(bad_content);
                } else {
                    res.header('ETag', TEST_ETAG);
                    res.status(200).send(TEST_CONTENT);
                }
                req_cnt++;
            });
        });

        async.waterfall([
            function (wf_next) {
                request(url, function (err, res, content) {
                    test.equal(res.statusCode, 404);
                    wf_next(null, res.headers.etag);
                });
            }, function (etag, wf_next) {
                var opts = {
                    url: url,
                    headers: { "If-None-Match": etag } 
                };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.equal(content, TEST_CONTENT);
                    wf_next();
                });
            }
        ], function () {
            test.done();
        });
    },

    "Should not cache a response for methods other than GET or HEAD": function (test) {
        var $this = this;

        var url = TEST_BASE_URL + '/test1',
            post_ct = 'POST CONTENT',
            post_etag = 'POST ETAG';

        $this.app.get('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.header('ETag', TEST_ETAG);
                res.send(TEST_CONTENT);
            });
        });
        $this.app.post('/test1', function (req, res) {
            $this.cache.cacheResponse(req, res, {}, function (req, res) {
                res.header('ETag', post_etag);
                res.send(post_ct);
            });
        });

        async.waterfall([
            function (wf_next) {
                var opts = { url: url, method: 'POST' };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    wf_next(null, res.headers.etag);
                });
            }, function (etag, wf_next) {
                var opts = { url: url, method: 'GET',
                             headers: { "If-None-Match": etag } };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.equal(content, TEST_CONTENT);
                    wf_next(null, res.headers.etag);
                });
            }, function (etag, wf_next) {
                var opts = { url: url, method: 'HEAD',
                             headers: { "If-None-Match": etag } };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 304);
                    test.equal(content, '');
                    wf_next();
                });
            }, function (wf_next) {
                var opts = { url: url, method: 'HEAD' };
                request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    test.equal(res.headers['x-cache'], 'HIT');
                    test.equal(content, '');
                    wf_next();
                });
            }
        ], function () {
            test.done();
        });
    },

    "Cache internals should support some HTTP caching semantics": function (test) {

        var test_key = "/docs/en-US/testdoc",
            expected_content = "THIS IS A TEST";
            expected_etag= "8675309JENNY";

        var now = (new Date()).getTime(),
            then_age = 600,
            then = now - (then_age * 1000),
            ancient_age = 86400,
            ancient = now - (ancient_age * 1000);

        var cache = new ks_caching.ResponseCache();

        var content_etag = null;

        async.waterfall([
            function (wf_next) {
                // Set the cache content.
                var opts = {
                    last_modified: then,
                    etag: expected_etag 
                };
                cache.set(test_key, 3600, null, expected_content, opts,
                    function (err, headers, content, meta) {
                        test.equal(meta.last_modified, opts.last_modified);
                        test.equal(meta.etag, expected_etag);
                        content_etag = meta.etag;
                        wf_next();
                    });
            }, function (wf_next) {
                // Try a get for something not found
                var opts = {};
                cache.get("/lol/wut", opts, function (err, headers, result_content, meta) {
                    test.equal(err, cache.ERR_MISS);
                    test.equal(result_content, null);
                    wf_next();
                });
            }, function (wf_next) {
                // Try an unconditional get
                var opts = {};
                cache.get(test_key, opts, function (err, headers, result_content, meta) {
                    test.equal(result_content, expected_content);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a max_age condition that should pass
                var opts = { max_age: ancient_age };
                cache.get(test_key, opts, function (err, headers, result_content, meta) {
                    test.equal(err, null);
                    test.equal(result_content, expected_content);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a max_age of 0
                var opts = { max_age: 0 };
                cache.get(test_key, opts, function (err, headers, result_content, meta) {
                    test.equal(err, cache.ERR_MISS);
                    test.equal(result_content, null);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a max_age condition that should fail
                var opts = { max_age: (then_age / 2) };
                cache.get(test_key, opts, function (err, headers, result_content, meta) {
                    test.equal(err, cache.ERR_STALE);
                    test.equal(result_content, null);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a if_none_match condition that should pass
                var opts = { if_none_match: "BADHASH" };
                cache.get(test_key, opts, function (err, headers, result_content, meta) {
                    test.equal(err, null);
                    test.equal(result_content, expected_content);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a if_none_match condition that should fail
                var opts = { if_none_match: content_etag };
                cache.get(test_key, opts, function (err, headers, result_content, meta) {
                    test.equal(err, cache.ERR_NOT_MODIFIED);
                    test.equal(result_content, null);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a if_modified_since condition that should pass
                var opts = { if_modified_since: ancient };
                cache.get(test_key, opts, function (err, headers, result_content, meta) {
                    test.equal(err, null);
                    test.equal(result_content, expected_content);
                    wf_next();
                });
            }, function (wf_next) {
                // Try a get with a if_modified_since condition that should fail
                var opts = { if_modified_since: now - (then_age/2) };
                cache.get(test_key, opts, function (err, headers, result_content, meta) {
                    test.equal(err, cache.ERR_NOT_MODIFIED);
                    test.equal(result_content, null);
                    wf_next();
                });
            }
        ], function () {
            test.done();
        });
    },

    "If a 304 is returned but the body content isn't in cache, force a 200 from kuma": function (test) {
        
        // Step 1:  do a test request for content, cache it (200)
        // Step 2:  do a test request that returns a 304, ensure the last_mod is future
        // Step 3:  remove the body from memcache *directly*
        // Step 4:  make a request that would otherwise trigger 304 but since the body is gone, last_mod is set to 0
        // Step 5:  ensure the next request is a 304 and cache has body

        var $this = this;
        var url = TEST_BASE_URL + '/test1';

        // Key generated the same as within caching.js
        var key = function (opts, name) { 
            var base_key = 'kumascript:request:' + ks_utils.md5(opts.url);
            return base_key + ':' + name; 
        }
        var cache = new ks_utils.FakeMemcached();
                
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

        async.waterfall([
            function (wf_next) { // Step 2:  Part 1
                var opts = getOptions();
                ks_caching.request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 200);
                    wf_next(null);
                });
            }, function (wf_next) {  // Step 2:  Part 2
                var opts = getOptions();
                ks_caching.request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 304);
                    test.ok(res.req._headers['if-modified-since'], 'A "if-modified-since" is set for the cached document request');

                    cache.get(key(opts, 'body'), function(err, res) {
                        test.ok(res != undefined, 'Content is properly stored in cache');
                        wf_next(null);
                    });
                });
            }, function (wf_next) { // Step 3
                var opts = getOptions();
                cache.remove(key(opts, 'body'), function() {
                    cache.get(key(opts, 'body'), function(err, res) {
                        test.ok(res === undefined, 'Content removed from fake cache');
                        wf_next(null);
                    });
                });
            }, function (wf_next) { // Step 4
                var opts = getOptions();
                ks_caching.request(opts, function (err, res, content) {
                    test.ok(res.req._headers['if-modified-since'] === undefined, 'A "if-modified-since" is *not* set for the document request');
                    test.equal(res.statusCode, 200);
                    wf_next(null);
                });
            }, function (wf_next) { // Step 5
                var opts = getOptions();
                ks_caching.request(opts, function (err, res, content) {
                    test.equal(res.statusCode, 304);
                    test.ok(res.req._headers['if-modified-since'], 'A "if-modified-since" is set again for the document request');

                    cache.get(key(opts, 'body'), function(err, res) {
                        test.ok(res != undefined, 'Content is properly stored in cache');
                        wf_next(null);
                    });
                });
            }
        ], function () {
            test.done();
        });
    }
});
