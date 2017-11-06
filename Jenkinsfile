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
          sh 'make build-kumascript'
          sh 'make build-kumascript KS_VERSION=latest'
        }

        stage('Lint') {
          dir('kumascript') {
            sh 'make lint VERSION=latest'
            sh 'make lint-macros VERSION=latest'
          }
        }

        stage('Test') {
          dir('kumascript') {
            try {
              sh 'make test VERSION=latest TEST_RUN_ARGS="--reporter mocha-junit-reporter"'
            } finally {
              junit 'test-results.xml'
            }
            try {
              sh 'make test-macros VERSION=latest TEST_RUN_ARGS="--reporter mocha-junit-reporter"'
            } finally {
              junit 'test-results.xml'
            }
          }
        }

        stage('Push KumaScript Docker Image') {
          sh 'make push-kumascript'
          sh 'make push-kumascript KS_VERSION=latest'
        }

        break

      case utils.STAGE_BRANCH_NAME:
        stage("Announce") {
          utils.announce_push()
        }

        stage("Prepare Infra") {
          // Checkout the "mozmeao/infra" repo's "master" branch into the
          // "infra" sub-directory of the current working directory.
          utils.checkout_repo(
            'https://github.com/mozmeao/infra', 'master', 'infra'
          )
        }

        stage('Push') {
          dir('infra/apps/mdn/mdn-aws/k8s') {
            // Start a rolling update of the Kumascript-based deployments.
            utils.rollout()
            // Monitor the rollout until it has completed.
            utils.monitor_rollout()
          }
        }

        break

      default:
        stage('Build') {
          sh 'make build-kumascript'
        }

        stage('Lint') {
          dir('kumascript') {
            sh 'make lint'
            sh 'make lint-macros'
          }
        }

        stage('Test') {
          dir('kumascript') {
            try {
              sh 'make test TEST_RUN_ARGS="--reporter mocha-junit-reporter"'
            } finally {
              junit 'test-results.xml'
            }
            try {
              sh 'make test-macros TEST_RUN_ARGS="--reporter mocha-junit-reporter"'
            } finally {
              junit 'test-results.xml'
            }
          }
        }

        break
    }
}
