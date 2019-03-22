/**
 * The Redis cache backend. See cache.js
 *
 * @prettier
 */
const Redis = require('redis');
const config = require('./config.js');
const client = Redis.createClient(config.redisURL);

module.exports = {
    /**
     * @param {string} key
     * @return {Promise<string|null>}
     */
    async get(key) {
        return new Promise(function(resolve, reject) {
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

    /**
     * @param {string} key
     * @param {string} value
     */
    set(key, value) {
        client.set(key, value, 'EX', config.cacheMinutes * 60);
    }
};
