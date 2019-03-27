VERSION ?= $(shell git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)
IMAGE_PREFIX ?= mdnwebdocs
IMAGE_NAME ?= kumascript
IMAGE ?= ${IMAGE_PREFIX}/${IMAGE_NAME}\:${VERSION}
MOUNT_DIR ?= $(shell pwd)
APP_DIR ?= /app
PORT ?= 9080
DOCKER_RUN_ARGS ?= -v ${MOUNT_DIR}\:${APP_DIR} -w ${APP_DIR}
DOCKER_PORT_ARGS ?= -p "${PORT}:${PORT}"

run:
	docker run ${DOCKER_RUN_ARGS} ${DOCKER_PORT_ARGS} ${IMAGE} node run.js

clean:
	rm -rf coverage

local-tests:
	npm run test
	npm run lint
	npm run lint-json

test:
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	  /node_modules/.bin/jest -w1

test-junit:
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	  /node_modules/.bin/jest --ci --testResultsProcessor="/node_modules/jest-junit-reporter"

test-coverage:
	rm -rf coverage
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	  /node_modules/.bin/jest -w1 --coverage --collectCoverageFrom='src/**'

lint:
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	  /node_modules/.bin/eslint *.js src tests

lint-json:
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	  bash -c "find . -name '*.json' -not -path './node_modules/*' -print0 | xargs -t -n1 -0 /node_modules/.bin/jsonlint -q"

bash:
	docker run -it ${DOCKER_RUN_ARGS} ${IMAGE} bash

shrinkwrap:
	docker run -it -v ${MOUNT_DIR}\:${APP_DIR} -w / -u root ${IMAGE} \
	    bash -c "npm shrinkwrap && cp npm-shrinkwrap.json ${APP_DIR}"

src/parser.js: src/parser.pegjs
	echo "/* eslint-disable */" > src/parser.js
	npx pegjs -o - src/parser.pegjs >> src/parser.js

.PHONY: clean run local-tests test test-junit test-coverage lint lint-json bash shrinkwrap
