import * as fs from 'fs';
import * as path from 'path';

import {Hook, registerHook} from 'openfin-service-tooling/utils/allowHook';

registerHook(Hook.TEST_MIDDLEWARE, (app) => {
    // Delay response. Useful to test timeouts
    // Use as http://localhost:3923/fakeDelay/?t=5000
    app.get('/fakeDelay', (req, res) => {
        let ms = req.query.t;
        ms = parseInt(ms) || 0;
        setTimeout(() => res.status(200).send({delay: ms}), ms);
    });
});
