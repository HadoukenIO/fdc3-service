pipeline {

    agent any

    stages {

        stage ('build') {
            agent { label 'linux-slave' }
            when { branch "develop" }
            steps {
                script {
                    GIT_SHORT_SHA = sh ( script: "git rev-parse --short HEAD", returnStdout: true ).trim()
                    S3_LOC = env.DSERVICE_S3_ROOT + "fdc3/" + GIT_SHORT_SHA
                    STAGING_JSON = env.DSERVICE_S3_ROOT + "fdc3/" + "app.staging.json"
                }
                sh "npm i"
                sh "GIT_SHORT_SHA=${GIT_SHORT_SHA} npm run build"
                sh "echo ${GIT_SHORT_SHA} > ./build/SHA.txt"
                sh "aws s3 cp ./build ${S3_LOC}/ --recursive"
                sh "aws s3 cp ./build/app.json ${STAGING_JSON}"
            }
        }

        stage ('test'){
            agent { label 'linux-slave' }
            when { not { branch "develop" } }
            steps {
                sh "npm i"
                sh "npm test"
            }
        }
    }
}
