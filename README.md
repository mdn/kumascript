# kumascript
[![Build Status](https://secure.travis-ci.org/mdn/kumascript.svg)](https://travis-ci.org/mdn/kumascript)
[![Dependency Status](https://david-dm.org/mdn/kumascript.svg?theme=shields.io)](https://david-dm.org/mdn/kumascript)
[![devDependency Status](https://david-dm.org/mdn/kumascript/dev-status.svg?theme=shields.io)](https://david-dm.org/mdn/kumascript#info=devDependencies)
[![What's deployed on stage,prod?](https://img.shields.io/badge/whatsdeployed-stage,prod-green.svg)](https://whatsdeployed.io/s/SWJ/mdn/kumascript)

## Overview

The KumaScript service takes requests to render raw documents (documents that
may contain one or more embedded macro calls), and responds with a
fully-rendered document (a document where each of the embedded macros
has been executed and replaced inline with its output). The
requests are via the `POST /docs` endpoint, with the raw
content of the document to be rendered included in the body of the POST.

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
      instructions completely (most likely you will want to install a sample
      database as well).
    * Go to the `kumascript` sub-directory within your cloned kuma repository.
      This is a git submodule that currently points to the Mozilla kumascript
      repository. Reconfigure this git submodule to point to your forked
      repository from step 1, and your new branch from step 2.

          git remote set-url origin <URL-TO-YOUR-FORKED-REPO-FROM-STEP-1>
          git fetch origin <BRANCH-NAME-FROM-STEP-2>
          git checkout <BRANCH-NAME-FROM-STEP-2>

    * Now you are ready to add, modify, and/or delete any macro (or other)
      files, and make commits. When you have made your changes and are ready
      for testing, you will want to run your local development version of MDN:

          cd ..
          docker-compose pull
          docker-compose up -d
          cd kumascript

    * If everything is OK, you can point your browser to http://localhost:8000,
      login, create a new document that uses your new or modified macro(s), and
      test that it renders correctly.

    * Run the KumaScript test suite; one of the tests in this suite
      verifies that all of the macros in the macros/ directory compile
      correctly and ensures that you do not have a JavaScript syntax
      error in your new or modified macros:

          make test

4. Open a pull request to merge your branch on your forked repository into
   the main Mozilla kumascript repository

Your pull request will be reviewed by one or more members of the MDN team, and
if accepted, your changes will be merged into the master branch and scheduled
for release to production.

## Updating the docker/Dockerfile and/or package.json file

If you update either one or both of these files, you'll need to do a little
more before you run your local development version of MDN.

* If you modified the `package.json` file, particularly if you modified the
  version of node or the dependencies section, replace `npm-shrinkwrap.json`
  with one that has no version information:

      echo '{}' > npm-shrinkwrap.json

* When you have made your changes and are ready for testing, you will first
  need to create a new KumaScript docker image as follows (assuming you are
  in the `kumascript` sub-directory):

      cd ..; KS_VERSION=latest make build-kumascript; cd kumascript

  The last line of output from your `make build-kumascript` command should
  look something like this:

      Successfully built 48ddc354b3f4
      Successfully tagged mdnwebdocs/kumascript:latest

* Test out the changes, and repeat building the image if unhappy:

      VERSION=latest make test
      VERSION=latest make lint
      VERSION=latest make lint-json

* If you modified the `package.json` file, create a new `npm-shrinkwrap.json`:

      VERSION=latest make shrinkwrap

  Commit the new `npm-shrinkwrap.json` file.

* (Optional) You can use your built image as the kumascript image in the MDN
  development environment, or you can remove it. To remove your local built
  image, run one of the following:

      docker rmi mdnwebdocs/kumascript:latest  # Remove without replacing
      docker pull mdnwebdocs/kumascript:latest # or replace with server's version

## Setup (Docker)

* Install [Docker](https://docs.docker.com/engine/installation/)

## Development (Docker)

* To build a Docker image (you will need to do this initially as well as after
  every `git commit`):
    * `cd ..; make build-kumascript; cd kumascript`
* To run the tests (for both server and macros):
    * `make test`
* To check test coverage:
    * `make test-coverage`
* To check your code (using ESLint):
    * `make lint`
* To verify that all JSON files are well-formed:
    * `make lint-json`
* To run the service:
    * `make run`

## Setup (Standalone)

* Install [Node.js](https://nodejs.org/en/download/package-manager/)
* Install the dependencies:
    * `npm install`

## Development (Standalone)

* To run the service:
    * `node run.js`
* To run tests:
    * `npm run test`
* To check test coverage:
    * `npn run test-coverage`
* To check code quality:
    * `npm run lint`
* To ensure that all JSON files are well-formed:
    * `npm run lint-json`
* To generate document macro parser (if parser.pegjs is modified):
    * `make parser.js`

On OS X, [kicker](https://github.com/alloy/kicker) is handy for auto-running
tests and lint on file changes:

    kicker -e'npm run lint' \
           -e'npm run test' \
           --no-growl \
           src tests

## Server source code

The file _run.js_ in this directory is the main entry point for the
KumaScript server. The most interesting code lives in the _src/_
directory, however:

- _src/server.js_ is the main server code. KumaScript is based on
  Express, and this file defines the endpoints that the server
  supports. The most interesting function here is `docs()` which handles
  POST requests to _/docs/_ and renders the macros in the body of the
  POST request.

- _src/render.js_ defines the asyncronous `render()` function that
  renders macros in a page, which is basically the main feature of
  KumaScript. In order to use the `render()` function, you need a
  `Templates` object (described below) and an environment object that
  defines values to be exposed to macros as `env.slug`, `env.title`,
  `env.locale`, etc. (Kuma passes these values to KumaScript through
  request headers. See the `getVariables()` function in
  _src/server.js_.)

- _src/parser.pegjs_ defines a parser for finding KumaScript macros
  invocations within `{{` and `}}` markers in an HTML file. This
  parser is compiled to `src/parser.js`.

- _src/templates.js_ defines the Templates class, which is essentially
  a wrapper around the _macros/_ directory. KumaScript uses EJS
  templates in the form of _*.ejs_ files.  Create a Templates object
  by passing the path to the _macros/_ directory to the `Templates()`
  constructor. Once you've done that, you can render a specific
  template by calling the `render()` method of your Templates
  object. The first argument is the lowercase name of the template,
  and the second argument is the context in which the template should
  be executed, which you obtain from an Environment object, as
  described below.

- _src/environment.js_ defines the Environment class which is used to
  create the context objects used for rendering templates. An
  Environment object defines the API (the `MDN.fetchJSONResource()`
  function, for example) that is available to KumaScript macros. When
  you create an Environment object, you must pass an environment
  object to the constructor, and the properties of this object define
  the per-page environment (values like `env.title` and `env.locale`)
  that macros can access. You typically create one Environment object
  per page to be rendered. Each macros within a page can have its own
  specific list of arguments, however. So to render an individual
  macro, call the `getExecutionContext()` method of your Environment
  object, and pass in an array of argument values. (The values will be
  available to macro code as `$0`, `$1`, etc.) `getExecutionContext()`
  returns the object that you pass to the `render()` method of your
  Templates object.

- _src/cache*.js_ defines a cache for resources fetched by KumaScript
  macros. If the config file (see below) defines a URL for a Redis
  service, then the cache will use Redis. Otherwise it uses a local
  LRU-based cache.

- _src/errors.js_ defines error classes that describe the possible
  error that can occur while rendering a page:

    * parser.js can detect a syntax error in the document itself
    * a document might try to use a macro that does not exist
    * there can be a syntax error in the .ejs file that prevents
      the macro from being compiled
    * an exception can occur at runtime when the macro is rendered

- _src/firelogger.js_ is a system for encoding an array of JavaScript
  exceptions into HTTP response headers. Because KumaScript can be
  asked to render many macros in a single request it always returns a
  valid response body. But if one or more of the macros on a page has
  errors, it also needs to return those errors.  _src/firelogger.js_
  is the clever middleware for doing that.

- _src/config.js_ defines configurable constants for KumaScript such
  as the port that the server listens on, the URL of the optional Redis
  server, and the length of time for which fetched data is cached. Some
  of these constants take their values from environment variables.
