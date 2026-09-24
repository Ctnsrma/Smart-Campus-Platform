pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code...'
                checkout scm
            }
        }

        stage('Install & Test') {
            agent {
                docker {
                    image 'node:22-alpine'
                    reuseNode true
                }
            }
            steps {
                sh 'npm install'
                sh 'npm run test:unit --workspace=@smart-campus/auth-service'
            }
        }
    }
}