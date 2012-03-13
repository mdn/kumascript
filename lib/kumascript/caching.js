// ## KumaScript HTTP caching

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    url = require('url'),
    crypto = require('crypto'),
    _ = require('underscore'),
    
    // TODO: Someday, strip out kumascript dependencies and spin this off into
    // its own package.
    ks_utils = require(__dirname + '/utils');


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
        this.meta_cache = {};
        this.content_cache = {};
    },

    // These methods are crappy, and need to be replaced with switchable
    // backends. (eg. memcache, filesystem, local memory with LRU)
    // TODO: Need a way to clear a cache entry
    // TODO: Implement LRU logic! use connect/lib/cache.js?
    // TODO: Separate into switchable backends (eg. locmem, memcache, fs)
    _setMeta: function (key, obj) { this.meta_cache[key] = obj; },
    _hasMeta: function (key) { return (key in this.meta_cache); },
    _getMeta: function (key) { return this.meta_cache[key]; },
    _setContent: function (key, obj) { this.content_cache[key] = obj; },
    _hasContent: function (key) { return (key in this.content_cache); },
    _getContent: function (key) { return this.content_cache[key]; },

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
            return $this.revalidate(null, req, res, null, response_cb);
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

        var ua_cc = $this.parseCacheControl(req.headers['cache-control'] || '');
        var ims = req.header('if-modified-since');

        var opts = {
            if_none_match: req.header('if-none-match'),
            if_modified_since: ims ?
                (new Date(ims)).getTime() : null,
            no_cache: !_.isUndefined(ua_cc['no-cache']),
            max_age: _.isUndefined(ua_cc['max-age']) ?
                $this.options.max_age : ua_cc['max-age']
        };

        $this.get(cache_key, opts, function (err, entry, meta) {
            if (err == $this.ERR_MISS || err == $this.ERR_STALE) {
                return $this.revalidate(cache_key, req, res, err, response_cb);
            } else if (err == $this.ERR_NOT_MODIFIED) {
                return $this.sendNotModified(req, res, meta);
            } else {
                return $this.sendCacheEntry(cache_key, req, res, entry, meta);
            }
        });
    },

    // ### parseCacheControl
    //
    // Parse the given Cache-Control `str`.
    //
    // Stolen from connect/lib/utils.js - could probably require it from there,
    // but only need this one thing for now.
    //
    parseCacheControl: function (str) {
        var directives = str.split(','),
            obj = {};

        for (var i=0, len=directives.length; i < len; i++) {
            var parts = directives[i].split('='),
                key = parts.shift().trim(),
                val = parseInt(parts.shift(), 10);

            obj[key] = isNaN(val) ? true : val;
        }

        return obj;
    },

    // ### revalidate
    //
    // Runs the real response handler, caches the result if necessary.
    //
    // Lots of monkeypatching here to intercept the response events and build
    // the cache entry for storage. 
    //
    revalidate: function (cache_key, req, res, err, response_cb) {
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

        // Monkeypatch to capture written body chunks
        var orig_write = res.write;
        res.write = function (chunk, encoding) {
            orig_write.apply(this, arguments);
            cached_body_chunks.push([chunk, encoding]);
        };

        // Monkeypatch to capture the final send and cache the response
        var orig_send = res.send;
        res.send = function (chunk, encoding) {
            orig_send.apply(this, arguments);
            if (200 == status_code) {
                if (chunk) {
                    cached_body_chunks.push([chunk, encoding]);
                }
                var entry = [ cached_headers, cached_body_chunks ];
                $this.set(cache_key, entry, cached_meta,
                    function (err, entry, meta) {
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
    sendCacheEntry: function (cache_key, req, res, entry, meta) {
        var $this = this,
            headers = entry[0],
            chunks = entry[1];

        $this.sendCommonHeaders(req, res, meta);

        res.header('X-Cache', 'HIT');
        
        _.each(headers, function (header) {
            res.header(header[0], header[1]);
        });
        
        var method = req.method.toUpperCase();
        if ('HEAD' != method) {
            _.each(chunks, function (chunk) {
                res.write(chunk[0], chunk[1]);
            });
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
    set: function (key, content, meta, next) {
        meta = meta || {};
        this._setMeta(key, meta);
        this._setContent(key, content);
        next(null, content, meta);
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

        if (0 === options.max_age) {
            // If I really wanted to, a this._hasMeta(key) would let me report
            // ERR_STALE instead of ERR_MISS. But, I wanted to skip hitting the
            // cache backend altogether (eg. memcache or filesystem)
            return next(this.ERR_MISS);
        }

        if (options.no_cache) {
            // See above.
            return next(this.ERR_MISS);
        }

        // Punt, if this key is not even in the cache
        if (!this._hasMeta(key)) {
            return next(this.ERR_MISS);
        }
        var meta = this._getMeta(key);

        // Check if the cache is too old
        if (typeof(options.max_age) != 'undefined') {
            var now = (new Date()).getTime(),
                last_modified = meta.last_modified,
                age = (now - last_modified) / 1000;
            if (age > options.max_age) {
                return next(this.ERR_STALE, null, meta);
            }
        }

        // Check modified since, if necessary
        if (typeof(options.if_modified_since) != 'undefined' &&
                (meta.last_modified <= options.if_modified_since)) {
            return next(this.ERR_NOT_MODIFIED, null, meta);
        }

        // Check the content etag, if necessary
        if (typeof(options.if_none_match) != 'undefined' &&
                (options.if_none_match == meta.etag)) {
            return next(this.ERR_NOT_MODIFIED, null, meta);
        }

        next(null, this._getContent(key), meta);
    }

});
