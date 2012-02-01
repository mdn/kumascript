# kumascript

Bringing scripting to the wiki bears.

## Setup
* Install [node.js 0.6.1+](http://nodejs.org/docs/v0.6.1/) and [npm](http://npmjs.org/)
* [kicker](https://github.com/alloy/kicker) is handy for auto-running tests and lint on file changes
* `npm install`

## Docs
* `./node_modules/docco/bin/docco lib/kumascript/*`

## Tests
* `./node_modules/nodeunit/bin/nodeunit tests/`

## Linting
* `./node_modules/jshint/bin/hint lib tests`
