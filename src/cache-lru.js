/**
 * The in-memory cache backend. See cache.js
 *
 * @prettier
 */
const LRU = require('lru-cache');
const config = require('./config.js');

/** @type {LRU.Cache<string, Buffer>} */
const lru = new LRU({
    max: 1024 * 1024 * config.cacheMegabytes,
    maxAge: 60000 * config.cacheMinutes,
    // The size of each cache entry is the length of the key (in chars)
    // plus the length of the value buffer (in bytes), and this is
    // approximately the total size in bytes.
    length: (v, k) => k.length + v.length
});

module.exports = {
    /**
     * @param {string} key
     * @return {string|null}
     */
    get(key) {
        let cached = lru.get(key);
        if (cached instanceof Buffer) {
            return cached.toString();
        } else {
            return null;
        }
    },

    /**
     * @param {string} key
     * @param {string} value
     */
    set(key, value) {
        lru.set(key, Buffer.from(value));
    }
};
