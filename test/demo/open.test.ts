import 'jest';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {connect} from 'hadouken-js-adapter';

const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};

describe('Opening directory applications', () => {

    const finPromise = connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST-open.ts'});

    describe('Without passing context', () => {

        test('When passing a valid app name the app opens and the promise resolves', async () => {
            const fin = await finPromise;

            // Check to see that the launcher window is running before proceeding
            await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);

            // From the launcher app, call fdc3.open with a valid name
            await fdc3Remote.open(testManagerIdentity, 'test-app-1');

            // Check that the app is now running
            await expect(fin.Application.wrapSync({uuid:'test-app-1'}).isRunning()).resolves.toBe(true);
        }, 10000);

        test('When passing an invalid app name the service returns an error', async () => {
            const fin = await finPromise;

            // Check to see that the launcher window is running before proceeding
            await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);

            // From the launcher app, call fdc3.open with an invalid name
            await expect(fdc3Remote.open(testManagerIdentity, 'invalid-app-name')).rejects.toThrowError();
        }, 10000);

        test('When opening an already running app the app is focused and the promise resolves', async () => {
            const fin = await finPromise;

            // Check to see that the launcher window is running before proceeding
            await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);

            // From the launcher app, call fdc3.open with a valid name
            await fdc3Remote.open(testManagerIdentity, 'test-app-1');

            // Check that the app is now running
            await expect(fin.Application.wrapSync({uuid:'test-app-1'}).isRunning()).resolves.toBe(true);
            // The app should be focused
            await expect(fin.System.getFocusedWindow().then(w => w.uuid)).resolves.toBe('test-app-1');
        }, 10000);
    });
});