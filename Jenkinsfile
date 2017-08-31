node {
    stage("Prepare") {
      // Checkout Kuma project's master branch
      checkout([$class: 'GitSCM',
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
               ])
      // Checkout KumaScript in subfolder
      dir('kumascript') {
        checkout scm
      }
    }
    switch (env.BRANCH_NAME) {
      case 'master':
        stage('Build') {
          sh 'make build-kumascript VERSION=latest'
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
          sh 'make push-kumascript VERSION=latest'
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
