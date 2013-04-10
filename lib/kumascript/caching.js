// ## KumaScript HTTP caching

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    url = require('url'),
    crypto = require('crypto'),
    request = require('request'),
    Memcached = require('memcached'),
    _ = require('underscore'),
    
    // TODO: Someday, strip out kumascript dependencies and spin this off into
    // its own package.
    ks_utils = require(__dirname + '/utils');


// ## parseCacheControl
//
// Parse the given Cache-Control `str`.
//
// Stolen from connect/lib/utils.js - could probably require it from there,
// but only need this one thing for now.
//
function parseCacheControl (str) {
    var directives = str.split(','),
        obj = {};

    for (var i=0, len=directives.length; i < len; i++) {
        var parts = directives[i].split('='),
            key = parts.shift().trim(),
            val = parseInt(parts.shift(), 10);

        if (key) {
            obj[key] = isNaN(val) ? true : val;
        }
    }

    return obj;
}

// ## ResponseCache
//
// Caching machinery for HTTP responses
//
module.exports.ResponseCache = ks_utils.Class({

    default_options: {
        max_age: 600
    },

    methods: [ 'GET', 'HEAD' ],
    ERR_NOT_MODIFIED: 'NOT_MODIFIED',
    ERR_STALE: 'STALE',
    ERR_MISS: 'MISS',

    initialize: function (options) {
        // Create a memcache instance, if necessary
        if (this.options.memcache) {
            var mo = this.options.memcache;
            this.memcached = new Memcached(mo.server, mo.options || {});
        } else {
            // If the configuration is missing, use the fake stub cache
            this.memcached = new ks_utils.FakeMemcached();
        }

        // Grab a statsd reporter
        this.statsd = ks_utils.getStatsD(this.options);
    },

    // ### cacheResponse
    //
    // Wrapper for a response handler. Will cache fresh responses from the
    // handler, and skip calling the handler altogether if the cache is valid.
    //
    // Honors HTTP cache control and conditional GET semantics.
    //
    // This kind of wants to be connect/express middleware, but it doesn't
    // *quite* work that way.
    //
    cacheResponse: function (req, res, options, response_cb) {
        var $this = this;

        // Shortcircuit on unsupported request methods
        var method = req.method.toUpperCase(),
            supported_methods = $this.methods;
        if (supported_methods.indexOf(method) === -1) {
            return $this.revalidate(null, {}, req, res, null, response_cb);
        }
        
        // Start building a cache key with the URL path.
        var cache_key_parts = [
            url.parse(req.url).pathname
        ];

        // Include the values of request headers specified in the Vary:
        // response header.
        var vary_names = (''+res.header('vary')).split(',')
                            .map(function (name) {
                                return name.trim().toLowerCase();
                            });
        vary_names.sort();
        vary_names.forEach(function (name) {
            cache_key_parts.push(name + ': ' + req.header(name));
        });

        // Build a cache key based on all the parts.
        var cache_key = 'response-cache:' + crypto.createHash('sha1')
            .update(cache_key_parts.join('|')).digest('hex');
         
        // Handy for diagnostics, maybe not needed
        res.header('X-Cache-Key', cache_key);

        var ua_cc = parseCacheControl(req.headers['cache-control'] || '');
        var ims = req.header('if-modified-since');

        var opts = {
            if_none_match: req.header('if-none-match'),
            if_modified_since: ims ?
                (new Date(ims)).getTime() : null,
            no_cache: !_.isUndefined(ua_cc['no-cache']),
            max_age: _.isUndefined(ua_cc['max-age']) ?
                $this.options.max_age : ua_cc['max-age']
        };

        var s_pre = 'response_caching.';
        if (opts.no_cache) {
            $this.statsd.increment(s_pre + 'no_cache');
        }
        if (opts.max_age == 0) {
            $this.statsd.increment(s_pre + 'max_age_zero');
        }

        $this.get(cache_key, opts, function (err, headers, body, meta) {
            if (err == $this.ERR_MISS || err == $this.ERR_STALE) {
                $this.statsd.increment(s_pre + 'miss');
                return $this.revalidate(cache_key, opts, req, res, err, response_cb);
            } else if (err == $this.ERR_NOT_MODIFIED) {
                $this.statsd.increment(s_pre + 'not_modified');
                return $this.sendNotModified(req, res, meta);
            } else {
                $this.statsd.increment(s_pre + 'hit');
                return $this.sendCacheEntry(cache_key, req, res, headers, body, meta);
            }
        });
    },

    // ### revalidate
    //
    // Runs the real response handler, caches the result if necessary.
    //
    // Lots of monkeypatching here to intercept the response events and build
    // the cache entry for storage. 
    //
    revalidate: function (cache_key, opts, req, res, err, response_cb) {
        var $this = this,
            cached_headers = [],
            cached_meta = { },
            cached_body_chunks = [],
            status_code = 999;

        // If there's no cache_key, skip all the caching monkeybusiness,
        if (!cache_key) {
            return response_cb(req, res);
        }

        // Monkeypatch to capture response headers
        var orig_setHeader = res.setHeader;
        res.setHeader = function (name, value) {
            orig_setHeader.apply(this, arguments);
            cached_headers.push([name, value]);

            name_lc = name.toLowerCase();
            if ('etag' == name_lc) {
                cached_meta.etag = value;
            }
            if ('last-modified' == name_lc) {
                cached_meta.last_modified = (new Date(value)).getTime();
            }
        };

        // Monkeypatch to set a Last-Modified header, if none in response
        var orig_writeHead = res.writeHead;
        res.writeHead = function (status, headers) {
            status_code = status;
            if (200 == status && _.isUndefined(cached_meta.last_modified)) {
                res.setHeader('Last-Modified', (new Date()).toUTCString());
            }
            orig_writeHead.apply(this, arguments);
        };

        // Cache body chunks as they come in.
        var cache_chunk = function (chunk, encoding) {
            // TODO: This *could* be trouble, if the response encoding isn't
            // UTF-8. The cache will have it encoded as UTF-8, but headers will
            // say otherwise. Probably good for now, though, since we're using
            // UTF-8 end-to-end in kumascript.
            cached_body_chunks.push(new Buffer(chunk, encoding)
                .toString('utf-8'));
        };

        // Monkeypatch to capture written body chunks
        var orig_write = res.write;
        res.write = function (chunk, encoding) {
            orig_write.apply(this, arguments);
            cache_chunk(chunk, encoding);
        };

        // Monkeypatch to capture the final send and cache the response
        var orig_send = res.send;
        res.send = function (chunk, encoding) {
            orig_send.apply(this, arguments);
            if (200 == status_code) {
                // Catch the last chunk, if any.
                if (chunk) { cache_chunk(chunk, encoding); }
                var cached_body = cached_body_chunks.join('');
                $this.set(cache_key, opts.max_age, cached_headers, cached_body, cached_meta,
                    function (err, headers, body, meta) {
                        /* No-op, fire and forget. */
                    }
                );
            }
        };

        // TODO: addTrailers?

        // Finally, signal to the origin handler that it's time to revalidate.
        return response_cb(req, res);
    },

    // ### sendCacheEntry
    //
    // Send the content from the cached response entry
    //
    sendCacheEntry: function (cache_key, req, res, headers, body, meta) {
        var $this = this;

        $this.sendCommonHeaders(req, res, meta);

        res.header('X-Cache', 'HIT');
        
        _.each(headers, function (header) {
            res.header(header[0], header[1]);
        });
        
        var method = req.method.toUpperCase();
        if ('HEAD' != method) {
            res.write(body, 'utf-8');
        }
        
        res.end();
    },

    // ### sendNotModified
    //
    // When a conditional GET signals no need to send content, this handles
    // sending the 304 Not Modified.
    //
    sendNotModified: function (req, res, meta) {
        this.sendCommonHeaders(req, res, meta);
        return res.send(304);
    },

    // ### sendCommonHeaders
    //
    // Send headers common to many responses.
    //
    sendCommonHeaders: function (req, res, meta) {
        var $this = this,
            now = (new Date());

        res.header('Age', Math.floor((now - meta.last_modified) / 1000));
        res.header('Date', new Date().toUTCString());
        if (meta.last_modified) {
            res.header('Last-Modified', new Date(meta.last_modified).toUTCString());
        }
        if (meta.etag) {
            res.header('ETag', meta.etag);
        }
    },

    // ### set
    //
    // Store a cache entry
    //
    set: function (key, max_age, headers, body, meta, next) {
        var $this = this;
        meta = meta || {};
        max_age = max_age || this.options.max_age;
        $this.memcached.set(key + ':headers', headers, max_age, function (e, r) {
            $this.memcached.set(key + ':body', body, max_age, function (e, r) {
                $this.memcached.set(key + ':meta', meta, max_age, function (e, r) {
                    next(null, headers, body, meta);
                });
            });
        });
    },

    // ### get
    //
    // Get a cache entry
    //
    // Implements HTTP caching semantics and responds with content as well
    // as STALE, NOT_MODIFIED, MISS errors
    //
    get: function (key, options, next) {
        options = options || {};
        var $this = this;

        if (0 === options.max_age) {
            // If I really wanted to, a $this._hasMeta(key) would let me report
            // ERR_STALE instead of ERR_MISS. But, I wanted to skip hitting the
            // cache backend altogether (eg. memcache or filesystem)
            return next($this.ERR_MISS);
        }

        // See above.
        if (options.no_cache) { return next($this.ERR_MISS); }
        
        $this.memcached.get(key + ':meta', function (err, meta) {
            // Punt, if $this key is not even in the cache
            if (!meta) { return next($this.ERR_MISS); }

            // Check if the cache is too old
            if (typeof(options.max_age) != 'undefined') {
                var now = (new Date()).getTime(),
                    last_modified = meta.last_modified,
                    age = (now - last_modified) / 1000;
                if (age > options.max_age) {
                    return next($this.ERR_STALE, null, null, meta);
                }
            }

            // Check modified since, if necessary
            if (typeof(options.if_modified_since) != 'undefined' &&
                    (meta.last_modified <= options.if_modified_since)) {
                return next($this.ERR_NOT_MODIFIED, null, null, meta);
            }

            // Check the content etag, if necessary
            if (typeof(options.if_none_match) != 'undefined' &&
                    (options.if_none_match == meta.etag)) {
                return next($this.ERR_NOT_MODIFIED, null, null, meta);
            }

            $this.memcached.get(key + ':headers', function (err, headers) {
                $this.memcached.get(key + ':body', function (err, body) {
                    next(err, headers, body, meta);
                });
            });
        });
    }

});


// ## request
//
// A conditional GET and caching wrapper for mikeal/request
module.exports.request = function (req_opts, cb) {
    var memcached = req_opts.memcached;
    var timeout = req_opts.timeout;
    var statsd = ks_utils.getStatsD(req_opts);

    var base_key = 'kumascript:request:' + ks_utils.md5(req_opts.url);
    var key = function (name) { return base_key + ':' + name; }

    var ua_cc = parseCacheControl(req_opts['cache_control'] || '');
    var max_age = 0;
    if (!_.isUndefined(ua_cc['no-cache'])) {
        max_age = 0;
    } else if (!_.isUndefined(ua_cc['max-age'])){
        max_age = parseInt(ua_cc['max-age']);
    }
    
    memcached.get(key('validated_at'), function (err, validated_at) {

        // Handle a cache entry younger than max-age as an implicit 304
        var now = (new Date()).getTime();
        var age = (now - parseInt(validated_at)) / 1000;
        if (age < max_age) {
            return handle304(memcached, key, timeout, null, false, cb);
        }

        // Otherwise, issue a conditional GET request using the cached
        // last-modified time.
        memcached.get(key('last_mod'), function (err, last_mod) {
            try {
                buildHeaders(req_opts, last_mod);
                request(req_opts, function (err, resp, source) {
                    if (err) {
                        cb(err, null);
                    } else if (304 == resp.statusCode) {
                        handle304(memcached, key, timeout, resp, true, cb);
                    } else if (200 == resp.statusCode) {
                        handle200(memcached, key, timeout, resp, source, cb);
                    } else {
                        cb("status " + resp.statusCode, null, null, false);
                    }
                });
            } catch(e) {
                cb(e, null, null, false);
            }
        });

    });
};

// Build headers for conditional GET, but only if we're not under a
// no-cache directive.
function buildHeaders (req_opts, last_mod) {
    var cache_control = req_opts.cache_control;
    var headers = {};
    if (cache_control) {
        headers['Cache-Control'] = cache_control;
    }
    if (cache_control != 'no-cache') {
        if (last_mod) {
            headers['If-Modified-Since'] = last_mod;
        }
        // TODO: Maybe Etag, someday. But, Kuma doesn't / can't send it, so
        // don't bother for now.
    }
    // Extend existing or set new request headers.
    if ('headers' in req_opts) {
        _.extend(req_opts.headers, headers);
    } else {
        req_opts.headers = headers;
    }
}

// If 304 Not Modified, fetch and respond with cached content.
function handle304 (memcached, key, timeout, resp, did_validate, cb) {
    memcached.get(key('body'), function (err, result) {
        // TODO: Seems like we need this to preserve UTF-8 in cache... really?
        var source = (!result) ? '' :
            (new Buffer(result, 'base64')).toString('utf-8');
        if (!did_validate) {
            cb(null, resp, source, true);
        } else {
            var now = (new Date()).getTime();
            memcached.set(key('validated_at'), now, timeout,
                function (err, result) {
                    cb(null, resp, source, true);
                }
            );
        }
    });
}

// If 200 OK, cache and respond with the fresh content.
function handle200 (memcached, key, timeout, resp, source, cb) {
    var validated_at = (new Date()).getTime();
    var last_mod = resp.headers['last-modified'] || '';
    // TODO: Seems like we need this to preserve UTF-8 in cache... really?
    var cache_source = (!source) ? '' :
        (new Buffer(source,'utf8')).toString('base64');
    // TODO: Promises might be nice for this sort of thing.
    memcached.set(key('body'), cache_source, timeout, function (err, result) {
        memcached.set(key('last_mod'), last_mod, timeout, function (err, result) {
            memcached.set(key('validated_at'), validated_at, timeout, function (err, result) {
                cb(null, resp, source, false);
            })
        })
    })
}
