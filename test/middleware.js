const fs = require('fs');
const path = require('path');

module.exports = (app) => {
    // Sneakily return the test directory instead of the default one
    app.get('/provider/sample-app-directory.json', (req, res) => {
        const testDirectory = JSON.parse(fs.readFileSync(path.join('res', 'test', 'sample-app-directory.json')));

        res.contentType('application/json');
        res.json(testDirectory);
    });

    // Delay response. Useful to test timeouts
    // Use as http://localhost:3923/fakeDelay/?t=5000
    app.get('/fakeDelay', (req, res) => {
        let ms = req.query.t;
        ms = parseInt(ms) || 0;
        setTimeout(() => res.status(200).send({delay: ms}), ms);
    });
};


