pipeline {
    agent any

    environment {
        IMAGE_TAG = "smart-campus-platform-auth-service:${env.BUILD_NUMBER}"
    }

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

        stage('Build Docker Image') {
            steps {
                sh "docker build -f services/auth-service/Dockerfile -t ${IMAGE_TAG} ."
            }
        }

        stage('Security Scan') {
            steps {
               sh "docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v trivy_cache:/root/.cache/ aquasec/trivy:latest image --db-repository public.ecr.aws/aquasecurity/trivy-db --timeout 15m --severity HIGH,CRITICAL --exit-code 0 ${IMAGE_TAG}"
            }
        }
    }
}