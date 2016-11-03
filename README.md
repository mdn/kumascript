# kumascript
[![Build Status](https://secure.travis-ci.org/mozilla/kumascript.svg)](https://travis-ci.org/mozilla/kumascript)
[![Dependency Status](https://david-dm.org/mozilla/kumascript.svg?theme=shields.io)](https://david-dm.org/mozilla/kumascript)
[![devDependency Status](https://david-dm.org/mozilla/kumascript/dev-status.svg?theme=shields.io)](https://david-dm.org/mozilla/kumascript#info=devDependencies)

## Overview

The KumaScript service takes requests to render raw documents (documents that
may contain one or more embedded macro calls), and responds with a
fully-rendered document (a document where each of the embedded macros
has been executed and replaced inline with its output). The
requests can be either via GET, with the full document path in the URL like
`GET /docs/en-US/JavaScript/Foo`, or via `POST /docs`, with the actual raw
content of the document included in the body of the POST. Here's an overview
of a GET request:

![KumaScript overview of GET](overview.png)

NOTE: If you'd like to update the diagram above, import `overview.xml` into
https://www.draw.io, make your changes, and export `overview.png`.

## Updating Macros

The actual macros available and used are under the `macros` directory of this
repository. For example, if your MDN document makes one or more calls to the
`CSSRef` macro (or `cssref`, since macro calls are case insensitive), the file
`macros/CSSRef.ejs` is the actual macro that will be executed.

In the past, these macros were stored within a database, and read, updated, or
deleted via MDN (the Kuma service). Since this is no longer true, when you want
to update one or more of these macros, you no longer do that via MDN, but
instead via this GitHub repository (see
https://guides.github.com/activities/contributing-to-open-source/). A quick
summary:

1. Fork the Mozilla kumascript repository
2. Create a branch for your changes
3. Make and test your changes
    * First you will need to install Docker and clone the Mozilla kuma
      repository. See https://kuma.readthedocs.io/en/latest/installation.html
      for detailed instructions on how to do this. Make sure you follow the
      instructions completely, to the bottom of the page.
    * Go to the kumascript sub-directory within your cloned kuma repository.
      This is a git submodule that currently points to the Mozilla kumascript
      repository. Reconfigure this git submodule to point to your forked
      repository from step 1, and your new branch from step 2.

          git remote set-url origin <URL-TO-YOUR-FORKED-REPO-FROM-STEP-1>
          git fetch origin <BRANCH-NAME-FROM-STEP-2>
          git checkout <BRANCH-NAME-FROM-STEP-2>

    * Now you are ready to add, modify, and/or delete any macro files, and then
      test them by running your local version of Kuma.
4. Open a pull request to merge your branch on your forked repository into
   the main Mozilla kumascript repository

Your pull request will be reviewed by one or more members of the MDN team, and
if accepted, your changes will be merged into the master branch and scheduled
for release to production.

## Setup (Docker)

* Install [Docker](https://docs.docker.com/engine/installation/)

## Development (Docker)

* To build a Docker image:
    * make build
* To run tests:
    * make test
* To run the service:
    * make run

## Setup (Standalone)

* Install [node.js 0.10.26](http://nodejs.org/docs/v0.10.26/) and [npm](http://npmjs.org/)
* `npm rebuild`

## Development (Standalone)

* To run the service:
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
