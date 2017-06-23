node {
    checkout scm

    switch (env.BRANCH_NAME) {
      case 'master':
        stage('Build') {
          sh 'make build VERSION=latest'
        }

        stage('Lint') {
          sh 'make lint VERSION=latest'
          sh 'make lint-macros VERSION=latest'
        }

        stage('Test') {
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

        stage('Push KumaScript Docker Image') {
          sh 'make push VERSION=latest'
        }

        break

      default:
        stage('Build') {
          sh 'make build'
        }

        stage('Lint') {
          sh 'make lint'
          sh 'make lint-macros'
        }

        stage('Test') {
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

        break
    }
}
