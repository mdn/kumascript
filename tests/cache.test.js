/**
 * Test the cache() function. Note, however, that we do not attempt to
 * test the timeout and the LRU features of the underlying node-lru cache.
 *
 * @prettier
 */
describe('cache() function', () => {
    beforeEach(() => {
        jest.resetModules();

        // Mock the redis client
        const redis = require('redis');
        const mockcache = {};
        redis.createClient = () => ({
            get(key, callback) {
                setTimeout(() => {
                    callback(null, mockcache[key] || null);
                }, 0);
            },

            set(key, value) {
                mockcache[key] = value;
            }
        });
    });

    it.each(['lru', 'redis'])(
        'does basic string caching (%s)',
        async backend => {
            const config = require('../src/config');
            config.redisURL = backend === 'lru' ? null : 'redis://';
            const cache = require('../src/cache.js');

            let compute = jest.fn(() => String(Math.random()));

            let value1 = await cache('key1', compute);
            let value2 = await cache('key2', compute);
            expect(compute.mock.calls.length).toBe(2);

            // Subsequent calls return the cached values
            // and do not invoke the compute() function.
            expect(await cache('key1', compute)).toBe(value1);
            expect(await cache('key2', compute)).toBe(value2);
            expect(compute.mock.calls.length).toBe(2);
        }
    );

    it.each(['lru', 'redis'])(
        'we can bypass cache with skipCache=true (%s)',
        async backend => {
            const config = require('../src/config');
            config.redisURL = backend === 'lru' ? null : 'redis://';
            const cache = require('../src/cache.js');

            let compute = jest.fn(() => String(Math.random()));

            await cache('key3', compute);
            expect(compute.mock.calls.length).toBe(1);

            await cache('key3', compute, true);
            expect(compute.mock.calls.length).toBe(2);
        }
    );

    it.each(['lru', 'redis'])('does not cache null (%s)', async backend => {
        const config = require('../src/config');
        config.redisURL = backend === 'lru' ? null : 'redis://';
        const cache = require('../src/cache.js');
        let compute = jest.fn(() => null);

        await cache('key4', compute);
        await cache('key5', compute);
        expect(compute.mock.calls.length).toBe(2);

        // Subsequent calls invoke the compute function again
        // since the null return value does not get cached.
        expect(await cache('key4', compute)).toBe(null);
        expect(await cache('key5', compute)).toBe(null);
        expect(compute.mock.calls.length).toBe(4);
    });

    it.each(['lru', 'redis'])(
        'will throw for non-string, non-null values (%s)',
        async backend => {
            const config = require('../src/config');
            config.redisURL = backend === 'lru' ? null : 'redis://';
            const cache = require('../src/cache.js');
            async function expectExceptionFor(x) {
                try {
                    let value = await cache('key6', () => x);
                    // If we get the x value back, that is an error
                    // because we are expecting an exception in this case
                    expect(value).not.toBe(x);
                } catch (e) {
                    // This is the success case: we expect an error
                    expect(e).toBeInstanceOf(TypeError);
                }
            }
            expectExceptionFor(0);
            expectExceptionFor(true);
            expectExceptionFor({});
            expectExceptionFor(/foo/);
        }
    );
});
