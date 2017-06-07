VERSION ?= $(shell git describe --tags --exact-match 2>/dev/null || git rev-parse --short HEAD)
REGISTRY ?= quay.io/
IMAGE_PREFIX ?= mozmar
IMAGE_NAME ?= kumascript
IMAGE ?= ${REGISTRY}${IMAGE_PREFIX}/${IMAGE_NAME}\:${VERSION}
MOUNT_DIR ?= $(shell pwd)
APP_DIR ?= /app
PORT ?= 9080
DOCKER_RUN_ARGS ?= -v ${MOUNT_DIR}\:${APP_DIR} -w ${APP_DIR}
DOCKER_PORT_ARGS ?= -p "${PORT}:${PORT}"
DEIS_PROFILE ?= usw
DEIS_APP ?= kumascript-dev
PRIVATE_IMAGE ?= ${PRIVATE_REGISTRY}/${DEIS_APP}\:${VERSION}
TEST_RUN_ARGS ?=
TEST_RUN_TIMEOUT ?= 10000


build:
	docker build -t ${IMAGE} .

push:
	docker push ${IMAGE}

run:
	docker run ${DOCKER_RUN_ARGS} ${DOCKER_PORT_ARGS} ${IMAGE} node run.js

test:
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	    /node_modules/.bin/mocha --timeout=${TEST_RUN_TIMEOUT} ${TEST_RUN_ARGS} tests

test-macros:
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	    /node_modules/.bin/mocha --timeout=${TEST_RUN_TIMEOUT} ${TEST_RUN_ARGS} tests/macros

lint:
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	    /node_modules/.bin/jshint --show-non-errors lib tests

lint-macros:
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	    /node_modules/.bin/ejslint "macros/**/*.ejs"
	docker run ${DOCKER_RUN_ARGS} ${IMAGE} \
	    /node_modules/.bin/jsonlint-cli "macros/**/*.json"

bash:
	docker run -it ${DOCKER_RUN_ARGS} ${IMAGE} bash

shrinkwrap:
	docker run -it -v ${MOUNT_DIR}\:${APP_DIR} -w / -u root ${IMAGE} \
	    bash -c "npm shrinkwrap && cp npm-shrinkwrap.json ${APP_DIR}"

deis-pull:
	deis pull ${IMAGE} -a ${DEIS_APP}

push-private-registry:
	docker tag ${IMAGE} ${PRIVATE_IMAGE}
	docker push ${PRIVATE_IMAGE}

deis-pull-private:
	deis pull ${DEIS_APP}:${VERSION} -a ${DEIS_APP}

build-deploy: build push deis-pull
build-private-deploy: build push-private-registry deis-pull-private

.PHONY: build push run test lint lint-macros bash shrinkwrap deis-pull push-private-registry deis-pull-private build-deploy build-private-deploy
