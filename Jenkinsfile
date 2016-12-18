node {
    checkout scm

    switch (env.BRANCH_NAME) {
      case 'master':
        stage('Build') {
          sh 'make build VERSION=latest'
        }

        stage('Test') {
          try {
              sh 'make test VERSION=latest TEST_RUN_ARGS="--reporter=junit --output=junit-results"'
          } finally {
              junit 'junit-results/*.xml'
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
          try {
              sh 'make test TEST_RUN_ARGS="--reporter=junit --output=junit-results"'
          } finally {
              junit 'junit-results/*.xml'
          }
        }

        break
    }
}
