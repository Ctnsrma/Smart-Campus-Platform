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
            steps {
                sh 'pwd'
                sh 'ls -la'
                sh '''
                    docker run --rm -v "$WORKSPACE":/app -w /app node:22-alpine sh -c "
                        npm install &&
                        npm run test:unit --workspace=@smart-campus/auth-service
                    "
                '''
            }
        }
    }
}