const openfinLauncher = require('hadouken-js-adapter');
const express = require('express');
const os = require('os')
const app = express();
const path = require('path');
const http = require('http');

const appsConf  = path.resolve('./build/demo/configs/app-launcher.json');

const port = process.env.port || 3012

app.use(express.static('./build'));

http.createServer(app).listen(port, () => {
    console.log(`Server running on port: ${port}`);
    openfinLauncher.launch({ manifestUrl: appsConf }).catch(err => console.log(err));
});
