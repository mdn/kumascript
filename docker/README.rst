kumascript
----------

The kumascript Docker image contains the kumascript rendering engine and
support files.

The image must be created from the kuma repo since it depends upon that
repo's ``locale`` sub-module. From the kuma repo's root directory, use
``make build-kumascript`` for an image tagged with the current commit-hash,
``make build-kumascript KS_VERSION=latest`` for one tagged with ``latest``,
or ``make build-kumascript-with-all-tags`` for an image tagged with both.

The image tagged ``latest`` is used by default for development, while an
image tagged with a commit-hash can be used for deployment. The official
images are created from the master branch in Jenkins__ and published to
DockerHub__.

.. __: https://ci.us-west-2.mdn.mozit.cloud/blue/organizations/jenkins/kumascript/branches/
.. __: https://hub.docker.com/r/mdnwebdocs/kumascript/
