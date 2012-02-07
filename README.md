# kumascript

Bringing scripting to the wiki bears.

![KumaScript overview](https://wiki.mozilla.org/images/thumb/2/2b/Kumascript.png/1000px-Kumascript.png)

## Setup

* Install [node.js 0.6.1+](http://nodejs.org/docs/v0.6.1/) and [npm](http://npmjs.org/)
* `npm install`

## Development

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

## Setup notes on CentOS (for Kuma VMs)

This needs to be puppetized, once things are more stable. But, this should get
a working node.js for the purposes of this project on a Kuma VM:

    sudo su
    wget http://nodejs.tchol.org/repocfg/el/nodejs-stable-release.noarch.rpm
    yum localinstall --nogpgcheck nodejs-stable-release.noarch.rpm
    yum install -y nodejs npm
    ln -s /usr/bin/nodejs  /usr/bin/node
    ln -s /usr/include/nodejs /usr/include/node

Then, you can do `npm install` as a non-root user (eg. `vagrant`) from the
project directory.

As of this writing, the above installs node v0.6.9. Not precisely the version
required in `package.json`, but it works just fine. Beware an upgrade to
v0.7.x, though.
