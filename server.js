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

    // launch the main demo apps launcher
    openfinLauncher.launch({ manifestUrl: appsConf }).catch(err => console.log(err));

    // on OS X we need to launch the provider manually (no RVM)
    if (os.platform() === 'darwin') {
        console.log("Starting Provider for Mac OS");
        const providerConf = path.resolve('./build/app.json');
        openfinLauncher.launch({ manifestUrl: providerConf }).catch(err => console.log(err));
    }
});
