FROM debian:jessie

ENV PYTHONDONTWRITEBYTECODE=1

# need python and build-essential for node-gyp
RUN apt-get update && \
    apt-get install -y --no-install-recommends python2.7 build-essential nodejs npm
RUN update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

WORKDIR /app
COPY . /app
RUN npm install


