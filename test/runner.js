const fs = require('fs');
const path = require('path');

exports.default = (app) => {
    // Sneakily return the test directory instead of the default one
    app.get('/provider/sample-app-directory.json', (req, res) => {
        const testDirectory = JSON.parse(fs.readFileSync(path.join('res', 'test', 'sample-app-directory.json')));

        res.contentType('application/json');
        res.json(testDirectory);
    });
};


