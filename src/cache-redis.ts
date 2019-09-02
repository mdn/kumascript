/**
 * The Redis cache backend. See cache.js
 *
 * @prettier
 */
import Redis = require('redis');
import config = require('./config');

const client = Redis.createClient(config.redisURL!);

module.exports = {
    get(key: string) {
        return new Promise<string | null>(resolve => {
            client.get(key, (err, response) => {
                if (err) {
                    /* eslint-disable no-console */
                    console.error('Error from Redis server:', err);
                    /* eslint-enable no-console */
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    },

    set(key: string, value: string) {
        return client.set(key, value, 'EX', config.cacheMinutes * 60);
    }
};
