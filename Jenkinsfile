#!groovy

@Library('github.com/mozmeao/jenkins-pipeline@master')

def test(what, docker_tag='') {
    def make_what = (what == 'code') ? 'test' : 'test-macros'
    def jenkins_uid = sh(script: 'id -u jenkins', returnStdout: true).trim()
    // The user ID within the Docker container must match the "jenkins"
    // user ID so that it's able to create the "test-results.xml" file.
    def run_args = "-u ${jenkins_uid}" + ' -v ${PWD}:${APP_DIR} -w ${APP_DIR}'
    try {
        withEnv(["VERSION=${docker_tag}",
                 "DOCKER_RUN_ARGS=${run_args}",
                 'TEST_RUN_ARGS=--reporter mocha-junit-reporter']) {
            utils.sh_with_notify("make ${make_what}",
                                 "Test the Kumascript ${what}")
        }
    } finally {
        junit 'test-results.xml'
    }
}

def lint(what, docker_tag='') {
    def make_what = (what == 'code') ? 'lint' : 'lint-macros'
    withEnv(["VERSION=${docker_tag}"]) {
        utils.sh_with_notify("make ${make_what}",
                             "Lint the Kumascript ${what}")
    }
}

def test_kumascript(docker_tag='') {
    dir('kumascript') {
        test('code', docker_tag)
        test('macros', docker_tag)
    }
}

def lint_kumascript(docker_tag='') {
    dir('kumascript') {
        lint('code', docker_tag)
        lint('macros', docker_tag)
    }
}

def image(what, docker_tag='') {
    def what_cap = what.capitalize()
    def tag_type = (docker_tag == '') ? 'commit-tagged' : 'latest-tagged'
    withEnv(["KS_VERSION=${docker_tag}"]) {
        utils.sh_with_notify("make ${what}-kumascript",
                             "${what_cap} the ${tag_type} Kumascript image")
    }
}

node {
    stage("Prepare") {
        // Checkout Kuma project's master branch
        checkout(
            [$class: 'GitSCM',
             userRemoteConfigs: [[url: 'https://github.com/mozilla/kuma']],
             branches: [[name: 'refs/heads/master']],
             extensions: [[$class: 'SubmoduleOption',
                           disableSubmodules: false,
                           parentCredentials: false,
                           recursiveSubmodules: true,
                           reference: '',
                           trackingSubmodules: false]],
             doGenerateSubmoduleConfigurations: false,
             submoduleCfg: []
            ]
        )
        // Load some utility functions defined in Kuma
        utils = load 'Jenkinsfiles/utils.groovy'
        // Checkout KumaScript in subfolder
        dir('kumascript') {
            checkout scm
            setGitEnvironmentVariables()
        }
    }
    // TODO: After cutover to IT-owned cluster, make "mdnwebdocs" the default
    //       value for IMAGE_PREFIX in the Makefile, and remove this code.
    def image_prefix = utils.is_mozmeao_pipeline() ? 'quay.io/mozmar' : 'mdnwebdocs'
    withEnv(["IMAGE_PREFIX=${image_prefix}"]) {
        switch (env.BRANCH_NAME) {
            case 'master':
                stage('Build') {
                    image('build')
                    image('build', 'latest')
                }
                stage('Lint') {
                    lint_kumascript('latest')
                }
                stage('Test') {
                    test_kumascript('latest')
                }
                stage('Push KumaScript Docker Image') {
                    image('push')
                    image('push', 'latest')
                }
                break

            case [utils.PROD_BRANCH_NAME, utils.STAGE_BRANCH_NAME, utils.STANDBY_BRANCH_NAME]:
                stage("Announce") {
                    utils.announce_push()
                }
                stage("Check Pull") {
                    // Ensure the image can be successfully pulled from the registry.
                    utils.ensure_pull()
                }
                stage("Prepare Infra") {
                    // Checkout the "mdn/infra" repo's "master" branch into the
                    // "infra" sub-directory of the current working directory.
                    utils.checkout_repo(
                        'https://github.com/mdn/infra', 'master', 'infra'
                    )
                }
                stage('Push') {
                    def kuma_image_tag = sh(
                        returnStdout: true,
                        script: 'git rev-parse --short=7 HEAD'
                    ).trim()
                    withEnv(["KUMA_IMAGE_TAG=${kuma_image_tag}"]) {
                        dir('infra/apps/mdn/mdn-aws/k8s') {
                            def current_revision_hash = utils.get_revision_hash()
                            withEnv(["FROM_REVISION_HASH=${current_revision_hash}"]) {
                                // Start a rolling update of the Kumascript-based deployments.
                                utils.rollout()
                                // Monitor the rollout until it has completed.
                                utils.monitor_rollout()
                                // Record the rollout in external services like New-Relic.
                                utils.record_rollout()
                            }
                        }
                    }
                }
                break

            default:
                stage('Build') {
                    image('build')
                }
                stage('Lint') {
                    lint_kumascript()
                }
                stage('Test') {
                    test_kumascript()
                }
                break
        }
    }
}
