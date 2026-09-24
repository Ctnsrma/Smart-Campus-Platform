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
                sh '''
                    docker run --rm -v jenkins_home:/var/jenkins_home -w /var/jenkins_home/workspace/smart-campus-pipeline -e JWT_ACCESS_SECRET=ci-test-secret node:22-alpine sh -c "
                        npm install &&
                        npm run test:unit --workspace=@smart-campus/auth-service
                    "
                '''
            }
        }
    }
}