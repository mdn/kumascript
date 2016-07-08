FROM debian:jessie

ENV PYTHONDONTWRITEBYTECODE=1

# need python and build-essential for node-gyp
RUN apt-get update && \
    apt-get install -y --no-install-recommends python2.7 build-essential nodejs npm
RUN update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

ENV NODE_PATH=/node_modules
COPY package.json /
RUN npm install

CMD ["node", "run.js"]
WORKDIR /app
COPY . /app
