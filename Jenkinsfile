pipeline {

    agent { label 'linux-slave' }

    stages {

        stage ('test'){
            steps {
                sh "npm i"
                sh "npm run check"
                sh "npm test"
            }
        }

        stage ('build') {
            when { branch "develop" }
            steps {
                script {
                    GIT_SHORT_SHA = sh ( script: "git rev-parse --short HEAD", returnStdout: true ).trim()
                    VERSION = sh ( script: "node -pe \"require('./package.json').version\"", returnStdout: true ).trim()
                    PREREL_VERSION = VERSION + "-alpha." + env.BUILD_NUMBER
                    S3_LOC = env.DSERVICE_S3_ROOT + "fdc3/" + GIT_SHORT_SHA
                    STAGING_JSON = env.DSERVICE_S3_ROOT + "fdc3/" + "app.staging.json"
                }
                sh "npm i"
                sh "GIT_SHORT_SHA=${GIT_SHORT_SHA} npm run build"
                sh "echo ${GIT_SHORT_SHA} > ./build/SHA.txt"
                sh "aws s3 cp ./build ${S3_LOC}/ --recursive"
                sh "aws s3 cp ./build/app.json ${STAGING_JSON}"
                echo "publishing pre-release version to npm: " + PREREL_VERSION
                withCredentials([string(credentialsId: "NPM_TOKEN_WRITE", variable: 'NPM_TOKEN')]) {
                    sh "echo //registry.npmjs.org/:_authToken=$NPM_TOKEN > $WORKSPACE/.npmrc"
                }
                sh "npm version --no-git-tag-version " + PREREL_VERSION
                sh "npm publish --tag alpha"
                sh "npm version --no-git-tag-version " + VERSION
            }
        }

        stage ('build-prod') {
            when { branch "master" }
            steps {
                script {
                    GIT_SHORT_SHA = sh ( script: "git rev-parse --short HEAD", returnStdout: true ).trim()
                    VERSION = sh ( script: "node -pe \"require('./package.json').version\"", returnStdout: true ).trim()
                    S3_LOC = env.DSERVICE_S3_ROOT + "fdc3/" + GIT_SHORT_SHA
                    PROD_JSON = env.DSERVICE_S3_ROOT + "fdc3/" + "app-" + VERSION + ".json"
                }
                sh "npm i"
                sh "GIT_SHORT_SHA=${GIT_SHORT_SHA} npm run build"
                sh "echo ${GIT_SHORT_SHA} > ./build/SHA.txt"
                sh "aws s3 cp ./build ${S3_LOC}/ --recursive"
                sh "aws s3 cp ./build/app.json ${PROD_JSON}"
                echo "publishing to npm, version: " + VERSION
                withCredentials([string(credentialsId: "NPM_TOKEN_WRITE", variable: 'NPM_TOKEN')]) {
                    sh "echo //registry.npmjs.org/:_authToken=$NPM_TOKEN > $WORKSPACE/.npmrc"
                }
                sh "npm publish"
            }
        }
    }
}
