import {testManagerIdentity, testAppNotInDirectory1} from './constants';
import {clearDirectoryStorage, setupTeardown, setupStartNonDirectoryAppBookends} from './utils/common';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {delay, Duration} from './utils/delay';

setupTeardown();

describe('When starting a non-directory app', () => {
    setupStartNonDirectoryAppBookends(testAppNotInDirectory1);

    afterEach(async () => {
        await clearDirectoryStorage();
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
});
