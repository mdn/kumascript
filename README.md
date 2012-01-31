# kuma-script

Bringing scripting to the wiki bears.

## Dev setup
* `npm install`

## Running tests
* `./node_modules/nodeunit/bin/nodeunit tests/`
* If you have [kicker](https://github.com/alloy/kicker), this is handy:
    * `kicker -c --no-growl -e'./node_modules/nodeunit/bin/nodeunit tests/' lib tests`

## Linting
* `./nodeunit/jshint/bin/hint lib tests`
* If you have [kicker](https://github.com/alloy/kicker), this is handy:
    * `kicker -c --no-growl -e './node_modules/jshint/bin/hint lib tests' lib tests`
