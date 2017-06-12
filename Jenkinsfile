node {
    checkout scm

    switch (env.BRANCH_NAME) {
      case 'master':
        stage('Build') {
          sh 'make build VERSION=latest'
        }

        stage('Test') {
          sh 'make lint-macros'
          try {
            sh 'make test VERSION=latest TEST_RUN_ARGS="--reporter mocha-junit-reporter"'
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

        stage('Test') {
          sh 'make lint-macros'
          try {
            sh 'make test TEST_RUN_ARGS="--reporter mocha-junit-reporter"'
          } finally {
            junit 'test-results.xml'
          }
        }

        break
    }
}
