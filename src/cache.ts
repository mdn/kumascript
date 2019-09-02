/**
 * This module defines a cache() function for caching the strings
 * returned by other functions. It is used by cacheFn() in environment.js.
 *
 * KumaScript originally used memcached for caching. This module is a
 * new backend to replace memcached and is configurable to use Redis
 * or an in-memory LRU cache with a bounded size.
 *
 * @prettier
 */
import config = require('./config');

interface Backend {
    get(key: string): string | Promise<string>;
    set(key: string, value: string): boolean | Promise<boolean>;
}

/**
 * The cache() function that is exported by this module needs async
 * get and set functions that represent the actual caching
 * operations. If our configuration includes Redis we'll use
 * that. Otherwise we'll fall back to an in-memory LRU cache.
 */
const backend: Backend = config.redisURL
    ? require('./cache-redis')
    : require('./cache-lru');

/**
 * Look up the specified key in the cache, and return its value if
 * we have one. Otherwise, call the computeValue() function to compute
 * the value, store it in the cache, and return the value. If skipCache
 * is true, skip the initial cache query and always re-compute the value.
 *
 * Note that computeValue() is expected to be an async function, and
 * we await its result. The result is that this function is async even
 * though the current LRU-based cache is not itself async.
 */
async function cache(key: string, computeValue: () => (string | null | PromiseLike<string | null>), skipCache = false): Promise<string | null> {
    if (!skipCache) {
        let cached = await backend.get(key);
        if (cached !== null) {
            return cached;
        }
    }

    let value = await computeValue();
    if (typeof value === 'string') {
        await backend.set(key, value);
    } else if (value !== null) {
        // The legacy computeValue() functions we're using in environment.js
        // don't have a way to report async errors and typically just report
        // a value of null if anything goes wrong. Redis uses null as the
        // return value for a missing key, so we can't cache a null value
        // and will recompute it each time. If the computeValue() function
        // returns anything other than a string or null, we throw an error.
        throw new TypeError('cached functions should return string values');
    }

    return value;
}

export = cache;
