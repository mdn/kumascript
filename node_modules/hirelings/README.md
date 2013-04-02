node-hirelings
==============

[![Build Status](https://secure.travis-ci.org/lmorchard/node-hirelings.png)](http://travis-ci.org/lmorchard/node-hirelings)

node-hirelings is a lightweight work queue using child processes. 

Use this to perform work that might block the event loop for awhile, possibly
fail spectacularly, and might need to be aborted impolitely.

This is heavily inspired by [lloyd/compute-cluster](https://github.com/lloyd/node-compute-cluster).
In fact, node-hirelings began life as a great big pull request before I
realized that was a dumb idea and just started my own project.

Installation
------------

````
$ npm install git://github.com/lmorchard/node-hirelings
````

**TODO:** Needs submission to npm. (*I'm scared, Sarge.*)

Usage
-----

**TODO:** Need something sensible here. Tests are an example, for now.

API
---

**TODO:** Need something sensible here. Maybe pointer to
[docco](http://jashkenas.github.com/docco/) output from `lib/hirelings.js`?

Frequently Anticipated Questions
--------------------------------

* Why "hirelings"?
    * It amuses me to pick odd names for projects. Hirelings are the
      semi-disposable, semi-reliable hired help that players can pick up in
      role-playing games.

License
-------

This Source Code Form is subject to the terms of the Mozilla Public License, v.
2.0. If a copy of the MPL was not distributed with this file, You can obtain
one at http://mozilla.org/MPL/2.0/.
