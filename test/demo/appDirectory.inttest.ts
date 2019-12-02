import {testManagerIdentity, testAppNotInDirectory1, testAppInDirectory1, testAppOnlyInSnippet1, testAppOnlyInSnippet2} from './constants';
import {clearDirectoryShard, setupTeardown, setupStartNonDirectoryAppBookends, quitApps, waitForAppToBeRunning, setupOpenDirectoryAppBookends} from './utils/common';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay, Duration} from './utils/delay';
import {fin} from './utils/fin';

const testAppName = 'Test App Name';
const testAppIntentName = 'App Directory Test Intent';
const testContent = {type: 'Test Context'};

afterEach(async () => {
    await clearDirectoryShard();
});

setupTeardown();

describe('When running a directory app', () => {
    setupOpenDirectoryAppBookends(testAppInDirectory1);

    afterEach(async () => {
        await clearDirectoryShard();
        await quitApps(testAppNotInDirectory1);
        await quitApps(testAppOnlyInSnippet1);
    });

    test('The app can add a different app to the app directory', async () => {
        const appInfo = {
            appId: testAppNotInDirectory1.uuid,
            name: testAppName,
            manifest: testAppNotInDirectory1.manifestUrl,
            manifestType: 'openfin',
            intents: [{name: testAppIntentName}]
        };

        // Set the new app info
        await fdc3Remote.registerAppDirectory(testAppInDirectory1, [appInfo]);
        await delay(Duration.API_CALL);

        // Test the service is aware of intents from the new app info
        const result = await fdc3Remote.findIntent(testManagerIdentity, testAppIntentName);
        expect(result.apps).toEqual([appInfo]);

        // Test the service knows the app's name from the new app info
        const openPromise = fdc3Remote.open(testManagerIdentity, testAppName, testContent);
        await waitForAppToBeRunning(testAppNotInDirectory1);
        const contextListener = await fdc3Remote.addContextListener(testAppNotInDirectory1);
        await openPromise;

        await expect(contextListener).toHaveReceivedContexts([testContent]);

        // Test we have two distinct running apps
        const uuids = (await fin.System.getAllApplications()).map((runningAppInfo) => runningAppInfo.uuid);
        expect(uuids).toContain(testAppInDirectory1.uuid);
        expect(uuids).toContain(testAppNotInDirectory1.uuid);
    });

    test('The app can add a different app to the app directory, and this will persist beyond the lifetime of the original app', async () => {
        const appInfo = {
            appId: testAppNotInDirectory1.uuid,
            name: testAppName,
            manifest: testAppNotInDirectory1.manifestUrl,
            manifestType: 'openfin',
            intents: [{name: testAppIntentName}]
        };

        // Set the new app info and quit
        await fdc3Remote.registerAppDirectory(testAppInDirectory1, [appInfo]);
        await delay(Duration.API_CALL);
        await quitApps(testAppInDirectory1);

        // Test we can open the app from the app's new name
        const openPromise = fdc3Remote.open(testManagerIdentity, testAppName, testContent);
        await waitForAppToBeRunning(testAppNotInDirectory1);
        const contextListener = await fdc3Remote.addContextListener(testAppNotInDirectory1);
        await openPromise;

        await expect(contextListener).toHaveReceivedContexts([testContent]);
    });

    test('The app can add a URL to the app directory', async () => {
        await fdc3Remote.registerAppDirectory(testAppInDirectory1, 'http://localhost:3923/provider/sample-app-directory-snippet.json');
        await delay(Duration.API_CALL);
        await delay(Duration.LOCALHOST_HTTP_REQUEST);

        // Test we can open an app from the new snippet
        const openPromise = fdc3Remote.open(testManagerIdentity, testAppOnlyInSnippet1.name, testContent);
        await waitForAppToBeRunning(testAppOnlyInSnippet1);
        const contextListener = await fdc3Remote.addContextListener(testAppOnlyInSnippet1);
        await openPromise;

        await expect(contextListener).toHaveReceivedContexts([testContent]);

        // Test the service is aware of intents from the new snippet
        const result = await fdc3Remote.findIntent(testManagerIdentity, 'SnippetTestIntent');
        const appsNames = result.apps.map((app) => app.name);
        expect(appsNames).toContain(testAppOnlyInSnippet1.name);
        expect(appsNames).toContain(testAppOnlyInSnippet2.name);
    });
});

describe('When running a non-directory app', () => {
    setupStartNonDirectoryAppBookends(testAppNotInDirectory1);

    test('The app can add itself to the app directory', async () => {
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
});
