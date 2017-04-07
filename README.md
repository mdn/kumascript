# kumascript
[![Build Status](https://secure.travis-ci.org/mozilla/kumascript.svg)](https://travis-ci.org/mozilla/kumascript)
[![Dependency Status](https://david-dm.org/mozilla/kumascript.svg?theme=shields.io)](https://david-dm.org/mozilla/kumascript)
[![devDependency Status](https://david-dm.org/mozilla/kumascript/dev-status.svg?theme=shields.io)](https://david-dm.org/mozilla/kumascript#info=devDependencies)

[What's Deployed](https://whatsdeployed.io/s-FHK)

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
      for testing, you will want to run your local development version of MDN.
      Move up one level, back to the root directory of your kuma repository,
      and do the following:

          docker-compose build
          docker-compose up -d

    * If everything is OK, you can point your browser to http://localhost:8000,
      login, create a new document that uses your new or modified macro(s), and
      test that it renders correctly.

    * Run the macro linter to check for JavaScript syntax errors:

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
  version of node or the dependencies section, remove the `npm-shrinkwrap.json`
  file before you make your new docker image in the next step.
* When you have made your changes and are ready for testing, you will first
  need to create a new KumaScript docker image as follows (assuming you are
  in the `kumascript` sub-directory):

      make build

* Note the last line of output from your `make build` command above. It
  should look something like this:

      Successfully built 48ddc354b3f4

  but of course with a different image ID, which is the hexadecimal number
  `48ddc354b3f4` in the example above. You'll need this KumaScript image ID
  for the next step.
* Now you need to configure `docker-compose` such that when it starts and
  runs a KumaScript container as part of your local development version
  of MDN, it uses your new KumaScript image and not, for example, the latest
  released image (`quay.io/mozmar/kumascript`). To do this, move up one
  level to the `kuma` directory and edit the `docker-compose.yml` file
  there. Within `docker-compose.yml`, find the lines that specify the docker
  image to use for creating the kumascript container. They will probably look
  like this:

      kumascript:
          image: quay.io/mozmar/kumascript

  Replace the current image identifier, in this case
  `quay.io/mozmar/kumascript`, with your new KumaScript image ID, like this:

      kumascript:
          image: 48ddc354b3f4

* Now you are ready to run your local development version of MDN.
* Once you're happy with your changes (e.g., `make test` and `make lint` both
  run without any errors or warnings), and if, as mentioned above, you modified
  the `package.json` file and removed the old `npm-shrinkwrap.json` file,
  you'll need to create a new `npm-shrinkwrap.json` file and commit it,
  You can create a new `npm-shrinkwrap.json` file like this:

      make shrinkwrap

## Setup (Docker)

* Install [Docker](https://docs.docker.com/engine/installation/)

## Development (Docker)

* To build a Docker image (you will need to do this initially as well as after
  every `git commit`):
    * `make build`      
* To run the tests:
    * `make test`
* To check your code (using JSHint):
    * `make lint`
* To check for JavaScript syntax errors within all macros (using ejslint):
    * `make lint-macros`
* To run the service:
    * `make run`

## Setup (Standalone)

* Install [Node.js 6.9.2](https://nodejs.org/en/download/package-manager/)
* Install the dependencies:
    * `npm install`

## Development (Standalone)

* To run the service:
    * `node run.js`
* To run tests:
    * `./node_modules/.bin/nodeunit tests`
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
           -e'./node_modules/.bin/nodeunit tests' \
           --no-growl \
           lib tests
