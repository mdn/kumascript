/**
 * The Redis cache backend. See cache.js
 *
 * @prettier
 */
const Redis = require('redis');
const config = require('./config.js');
const client = Redis.createClient(config.redisURL);

module.exports = {
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

    set(key, value) {
        client.set(key, value, 'EX', config.cacheMinutes * 60);
    }
};
