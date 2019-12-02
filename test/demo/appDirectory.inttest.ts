import {testManagerIdentity, testAppNotInDirectory1, testAppNotInDirectory2} from './constants';
import {clearDirectoryShard, setupTeardown, setupStartNonDirectoryAppBookends, quitApps, waitForAppToBeRunning} from './utils/common';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay, Duration} from './utils/delay';
import {fin} from './utils/fin';

setupTeardown();

describe('When starting a non-directory app', () => {
    setupStartNonDirectoryAppBookends(testAppNotInDirectory1);

    afterEach(async () => {
        await clearDirectoryShard();
        await quitApps(testAppNotInDirectory2);
    });

    test('The app can add itself to the app directory', async () => {
        const testAppName = 'Test App Name';
        const testAppIntentName = 'App Directory Test Intent';
        const testContent = {type: 'Test Context'};

        const appInfo = {
            appId: testAppNotInDirectory1.uuid,
            name: testAppName,
            manifest: testAppNotInDirectory1.manifestUrl,
            manifestType: 'openfin',
            intents: [{name: testAppIntentName}]
        };

        // Set the new app info
        await fdc3Remote.registerAppDirectory(testAppNotInDirectory1, [appInfo]);
        await delay(Duration.API_CALL);

        // Test the service is aware of intents from the new app info
        const result = await fdc3Remote.findIntent(testManagerIdentity, testAppIntentName);
        expect(result.apps).toEqual([appInfo]);

        // Test the service knows the app's name from the new app info
        const contextListener = await fdc3Remote.addContextListener(testAppNotInDirectory1);
        await fdc3Remote.open(testManagerIdentity, testAppName, testContent);

        await expect(contextListener).toHaveReceivedContexts([testContent]);
    });

    test('The app can add a different app to the app directory', async () => {
        const testAppName = 'Test App Name';
        const testAppIntentName = 'App Directory Test Intent';
        const testContent = {type: 'Test Context'};

        const appInfo = {
            appId: testAppNotInDirectory2.uuid,
            name: testAppName,
            manifest: testAppNotInDirectory2.manifestUrl,
            manifestType: 'openfin',
            intents: [{name: testAppIntentName}]
        };

        // Set the new app info
        await fdc3Remote.registerAppDirectory(testAppNotInDirectory1, [appInfo]);
        await delay(Duration.API_CALL);

        // Test the service is aware of intents from the new app info
        const result = await fdc3Remote.findIntent(testManagerIdentity, testAppIntentName);
        expect(result.apps).toEqual([appInfo]);

        // Test the service knows the app's name from the new app info
        const openPromise = fdc3Remote.open(testManagerIdentity, testAppName, testContent);
        await waitForAppToBeRunning(testAppNotInDirectory2);
        const contextListener = await fdc3Remote.addContextListener(testAppNotInDirectory2);
        await openPromise;

        await expect(contextListener).toHaveReceivedContexts([testContent]);

        // Test we have two distinct running apps
        const uuids = (await fin.System.getAllApplications()).map((runningAppInfo) => runningAppInfo.uuid);
        expect(uuids).toContain(testAppNotInDirectory1.uuid);
        expect(uuids).toContain(testAppNotInDirectory2.uuid);
    });

    test('The app can add a different app to the app directory, and this will persist beyond the lifetime of the original app', async () => {
        const testAppName = 'Test App Name';
        const testAppIntentName = 'App Directory Test Intent';
        const testContent = {type: 'Test Context'};

        const appInfo = {
            appId: testAppNotInDirectory1.uuid,
            name: testAppName,
            manifest: testAppNotInDirectory1.manifestUrl,
            manifestType: 'openfin',
            intents: [{name: testAppIntentName}]
        };

        // Set the new app info and quit
        await fdc3Remote.registerAppDirectory(testAppNotInDirectory1, [appInfo]);
        await delay(Duration.API_CALL);
        await quitApps(testAppNotInDirectory1);

        // Test we can re-open the app from the app's new name
        const openPromise = fdc3Remote.open(testManagerIdentity, testAppName, testContent);
        await waitForAppToBeRunning(testAppNotInDirectory1);
        const contextListener = await fdc3Remote.addContextListener(testAppNotInDirectory1);
        await openPromise;

        await expect(contextListener).toHaveReceivedContexts([testContent]);
    });
});
