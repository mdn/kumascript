#!groovy

@Library('github.com/mozmeao/jenkins-pipeline@master')

utils = null

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
    switch (env.BRANCH_NAME) {
      case 'master':
        stage('Build') {
          utils.sh_with_notify(
            'make build-kumascript',
            "Build of commit-tagged Kumascript image"
          )
          utils.sh_with_notify(
            'make build-kumascript KS_VERSION=latest',
            "Build of latest-tagged Kumascript image"
          )
        }

        stage('Lint') {
          dir('kumascript') {
            utils.sh_with_notify(
              'make lint VERSION=latest',
              "Lint the Kumascript code"
            )
            utils.sh_with_notify(
              'make lint-macros VERSION=latest',
              "Lint the Kumascript macros"
            )
          }
        }

        stage('Test') {
          dir('kumascript') {
            try {
              utils.sh_with_notify(
                'make test VERSION=latest TEST_RUN_ARGS="--reporter mocha-junit-reporter"',
                "Test the Kumascript code"
              )
            } finally {
              junit 'test-results.xml'
            }
            try {
              utils.sh_with_notify(
                'make test-macros VERSION=latest TEST_RUN_ARGS="--reporter mocha-junit-reporter"',
                "Test the Kumascript macros"
              )
            } finally {
              junit 'test-results.xml'
            }
          }
        }

        stage('Push KumaScript Docker Image') {
          utils.sh_with_notify(
            'make push-kumascript',
            "Push the commit-tagged Kumascript image"
          )
          utils.sh_with_notify(
            'make push-kumascript KS_VERSION=latest',
            "Push the latest-tagged Kumascript image"
          )
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

        break

      default:
        stage('Build') {
          utils.sh_with_notify(
            'make build-kumascript',
            "Build of commit-tagged Kumascript image"
          )
        }

        stage('Lint') {
          dir('kumascript') {
            utils.sh_with_notify(
              'make lint',
              "Lint the Kumascript code"
            )
            utils.sh_with_notify(
              'make lint-macros',
              "Lint the Kumascript macros"
            )
          }
        }

        stage('Test') {
          dir('kumascript') {
            try {
              utils.sh_with_notify(
                'make test TEST_RUN_ARGS="--reporter mocha-junit-reporter"',
                "Test the Kumascript code"
              )
            } finally {
              junit 'test-results.xml'
            }
            try {
              utils.sh_with_notify(
                'make test-macros TEST_RUN_ARGS="--reporter mocha-junit-reporter"',
                "Test the Kumascript macros"
              )
            } finally {
              junit 'test-results.xml'
            }
          }
        }

        break
    }
}
