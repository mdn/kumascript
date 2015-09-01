# kumascript
[![Build Status](https://secure.travis-ci.org/mozilla/kumascript.svg)](https://travis-ci.org/mozilla/kumascript)
[![Dependency Status](https://david-dm.org/mozilla/kumascript.svg?theme=shields.io)](https://david-dm.org/mozilla/kumascript)
[![devDependency Status](https://david-dm.org/mozilla/kumascript/dev-status.svg?theme=shields.io)](https://david-dm.org/mozilla/kumascript#info=devDependencies)

Bringing scripting to the wiki bears.

![KumaScript overview](https://wiki.mozilla.org/images/thumb/2/2b/Kumascript.png/1000px-Kumascript.png)

## Setup

* Install [node.js 0.10.36](http://nodejs.org/docs/v0.10.36/) and [npm](http://npmjs.org/)
* `npm rebuild`

## Development

* To run the service (in kuma vagrant):
    * `cd /home/vagrant/src; node kumascript/run.js`
* To run the service (standalone):
    * Directly:
        * `node run.js`
    * Managed by `up`:
        * `./node_modules/.bin/up -p 9080 -w run.js`
* To run tests:
    * `./node_modules/.bin/nodeunit tests`
* To check code quality:
    * `./node_modules/.bin/hint lib tests`
        * This will make a racket if it hits `parser.js`
        * TODO: Ignore this file.
* To generate docs:
    * `./node_modules/.bin/docco lib/kumascript/*.js`
* To generate document macro parser (optional):
    * `./node_modules/.bin/pegjs lib/kumascript/parser.pegjs`
        * This is not required in dev, but should be done for production.
        * If `parser.js` is missing, the parser will be built on the fly.

On OS X, [kicker](https://github.com/alloy/kicker) is handy for auto-running
tests and lint on file changes:

    kicker -e'./node_modules/.bin/jshint lib tests' \
           -e'./node_modules/.bin/nodeunit tests' \
           -e'./node_modules/.bin/docco lib/kumascript/*.js' \
           --no-growl \
           lib tests
