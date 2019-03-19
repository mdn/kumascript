/**
 * The in-memory cache backend. See cache.js
 *
 * @prettier
 */
import LRU = require('lru-cache');
import config = require('./config');

const lru = new LRU<string, Buffer>({
    max: 1024 * 1024 * config.cacheMegabytes,
    maxAge: 60000 * config.cacheMinutes,
    // The size of each cache entry is the length of the key (in chars)
    // plus the length of the value buffer (in bytes), and this is
    // approximately the total size in bytes.
    length: (v, k) => k!.length + v.length
});

export = {
    get(key: string) {
        let cached = lru.get(key);
        if (cached instanceof Buffer) {
            return cached.toString();
        } else {
            return null;
        }
    },

    set(key: string, value: string) {
        return lru.set(key, Buffer.from(value));
    }
};
