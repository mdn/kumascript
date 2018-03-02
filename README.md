# kumascript
[![Build Status](https://secure.travis-ci.org/mdn/kumascript.svg)](https://travis-ci.org/mdn/kumascript)
[![Dependency Status](https://david-dm.org/mdn/kumascript.svg?theme=shields.io)](https://david-dm.org/mdn/kumascript)
[![devDependency Status](https://david-dm.org/mdn/kumascript/dev-status.svg?theme=shields.io)](https://david-dm.org/mdn/kumascript#info=devDependencies)

[What's Deployed](https://whatsdeployed.io/s-4kW)

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
          docker-compose build
          docker-compose up -d
          cd kumascript

    * If everything is OK, you can point your browser to http://localhost:8000,
      login, create a new document that uses your new or modified macro(s), and
      test that it renders correctly.

    * Run the macro linter to check for syntax errors:

          make lint-macros

4. Open a pull request to merge your branch on your forked repository into
   the main Mozilla kumascript repository

Your pull request will be reviewed by one or more members of the MDN team, and
if accepted, your changes will be merged into the master branch and scheduled
for release to production.

## Updating the Dockerfile and/or package.json file

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
      Successfully tagged quay.io/mozmar/kumascript:latest

* Test out the changes, and repeat building the image if unhappy:

      VERSION=latest make test
      VERSION=latest make lint

* If you modified the `package.json` file, create a new `npm-shrinkwrap.json`:

      VERSION=latest make shrinkwrap

  Commit the new `npm-shrinkwrap.json` file.

* (Optional) You can use your built image as the kumascript image in the MDN
  development environment, or you can remove it. To remove your local built
  image, run one of the following:

      docker rmi quay.io/mozmar/kumascript:latest  # Remove without replacing
      docker pull quay.io/mozmar/kumascript:latest # or replace with server's version

## Setup (Docker)

* Install [Docker](https://docs.docker.com/engine/installation/)

## Development (Docker)

* To build a Docker image (you will need to do this initially as well as after
  every `git commit`):
    * `cd ..; make build-kumascript; cd kumascript`
* To run the platform tests:
    * `make test`
* To run the macro tests:
    * `make test-macros`
* To check your code (using JSHint):
    * `make lint`
* To check for JavaScript syntax errors within the EJS macros (using `ejslint`)
  and JSON syntax errors within the JSON data files (using `jsonlint-cli`):
    * `make lint-macros`
* To run the service:
    * `make run`

## Setup (Standalone)

* Install [Node.js 8.x](https://nodejs.org/en/download/package-manager/)
* Install the dependencies:
    * `npm install`

## Development (Standalone)

* To run the service:
    * `node run.js`
* To run tests:
    * `./node_modules/.bin/mocha tests`
* To check code quality:
    * `./node_modules/.bin/jshint --show-non-errors lib tests`
        * This will make a racket if it hits `parser.js`
        * TODO: Ignore this file.
* To generate document macro parser (optional):
    * `./node_modules/.bin/pegjs lib/kumascript/parser.pegjs`
        * This is not required in dev, but should be done for production.
        * If `parser.js` is missing, the parser will be built on the fly.

On OS X, [kicker](https://github.com/alloy/kicker) is handy for auto-running
tests and lint on file changes:

    kicker -e'./node_modules/.bin/jshint lib tests' \
           -e'./node_modules/.bin/mocha tests' \
           --no-growl \
           lib tests
