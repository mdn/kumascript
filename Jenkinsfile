#!groovy

@Library('github.com/mozmeao/jenkins-pipeline@master')

def test(docker_tag='') {
    def jenkins_uid = sh(script: 'id -u jenkins', returnStdout: true).trim()
    // The user ID within the Docker container must match the "jenkins"
    // user ID so that it's able to create the "test-report.xml" file.
    def run_args = "-u ${jenkins_uid}" + ' -v ${PWD}:${APP_DIR} -w ${APP_DIR}'
    try {
        withEnv(["VERSION=${docker_tag}",
                 "DOCKER_RUN_ARGS=${run_args}"]) {
            utils.sh_with_notify("make test-junit",
                                 "Test the Kumascript code and macros")
        }
    } finally {
        junit 'test-report.xml'
    }
}

def lint(what, docker_tag='') {
    def make_what = (what == 'code') ? 'lint' : 'lint-json'
    withEnv(["VERSION=${docker_tag}"]) {
        utils.sh_with_notify("make ${make_what}",
                             "Lint the Kumascript ${what}")
    }
}

def test_kumascript(docker_tag='') {
    dir('kumascript') {
        test(docker_tag)
    }
}

def lint_kumascript(docker_tag='') {
    dir('kumascript') {
        lint('code', docker_tag)
        lint('json', docker_tag)
    }
}

def image(what, docker_tag='') {
    if ((what == 'build') && (docker_tag == 'all tags')) {
        utils.sh_with_notify("make build-kumascript-with-all-tags",
                             "Build the Kumascript image with all tags")
    } else {
        def what_cap = what.capitalize()
        def tag_type = (docker_tag == '') ? 'commit-tagged' : 'latest-tagged'
        withEnv(["KS_VERSION=${docker_tag}"]) {
            utils.sh_with_notify("make ${what}-kumascript",
                                 "${what_cap} the ${tag_type} Kumascript image")
        }
    }
}

node {
    stage("Prepare") {
        // Checkout Kuma project's master branch
        checkout(
            [$class: 'GitSCM',
             userRemoteConfigs: [[url: 'https://github.com/mdn/kuma']],
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
    switch (env.BRANCH_NAME) {
        case 'master':
            stage('Build') {
                image('build', 'all tags')
            }
            stage('Lint') {
                lint_kumascript('latest')
            }
            stage('Test') {
                test_kumascript('latest')
            }
            stage('Push KumaScript Docker Images') {
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
                        withEnv(["TO_REVISION_HASH=${env.GIT_COMMIT}",
                                 "FROM_REVISION_HASH=${current_revision_hash}"]) {
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
