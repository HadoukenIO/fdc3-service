const fs = require('fs');
const path = require('path');
const os = require('os');

const express = require('express');
const execa = require('execa');
const {launch} = require('hadouken-js-adapter');

let port;

// Should be cmd-line args at some point
const debugMode = true;
const skipBuild = false;

const cleanup = async res => {
    if (os.platform().match(/^win/)) {
        const cmd = 'taskkill /F /IM openfin.exe /T';
        execa.shellSync(cmd);
    } else {
        const cmd = `lsof -n -i4TCP:${port} | grep LISTEN | awk '{ print $2 }' | xargs kill`;
        execa.shellSync(cmd);
    }
    process.exit((res.failed===true) ? 1 : 0);
};

const fail = err => {
    console.error(err);
    process.exit(1);
};

const run = (...args) => {
    const p = execa(...args);
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);
    return p;
};

/**
 * Performs a clean build of the application and tests
 */
async function build() {
    await run('npm', ['run', 'clean']);
    await run('npm', ['run', debugMode ? 'build:dev' : 'build']);
}

async function serve() {
    return new Promise((resolve) => {
        const app = express();

        // Sneakily return the test directory instead of the default one
        app.get('/provider/sample-app-directory.json', (req, res) => {
            const testDirectory = JSON.parse(fs.readFileSync(path.join('res', 'test', 'sample-app-directory.json')));

            res.contentType('application/json');
            res.json(testDirectory);
        });

        app.use(express.static('dist'));
        app.use(express.static('res'));

        app.listen(3923, resolve);
    });
}

const buildStep = skipBuild ? Promise.resolve() : build();

buildStep
    .then(() => serve())
    .then(async () => {
        port = await launch({manifestUrl: 'http://localhost:3923/test/test-app-main.json'});
        console.log('Openfin running on port ' + port);
        return port;
    })
    .catch(fail)
    .then(OF_PORT => run('jest', ['--config', 'jest-int.config.json', '--forceExit', '--no-cache', '--runInBand'], {env: {OF_PORT}}))
    .then(cleanup)
    .catch(cleanup);
