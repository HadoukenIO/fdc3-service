import 'jest';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {getFinConnection} from './utils/fin';


describe('Broadcasting and context listeners', () => {
    const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};
    const testIdentity1 = {uuid: 'test-app-1', name: 'test-app-1'};
    const testIdentity2 = {uuid: 'test-app-2', name: 'test-app-2'};

    it('can can register and trigger a context listener', async () => {
        // Creating the apps can take a while, so we need a longer timeout.
        jest.setTimeout(20000);

        const fin = await getFinConnection();

        // Check to see that the main window started correctly
        await expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);

        // Launch two test applications
        await fdc3Remote.open(testManagerIdentity, testIdentity1.uuid);
        await fdc3Remote.open(testManagerIdentity, testIdentity2.uuid);

        // Check that the apps have started properly
        await expect(fin.Application.wrapSync(testIdentity1).isRunning()).resolves.toBe(true);
        await expect(fin.Application.wrapSync(testIdentity2).isRunning()).resolves.toBe(true);

        // Register a listener. We don't await as the promise won't resolve until
        // the listener is triggered
        const callbackSpy = jest.fn();
        const callbackResponse = fdc3Remote.addContextListener(testIdentity2, callbackSpy);
        await new Promise(res => setTimeout(
            res,
            1000
        ));  // Slight delay to ensure callback is properly registered

        // Send a context on app-1
        const broadcastPayload = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};
        await fdc3Remote.broadcast(testIdentity1, broadcastPayload);

        await expect(callbackResponse).resolves;
        expect(callbackSpy).toHaveBeenCalledTimes(1);
        expect(callbackSpy).toHaveBeenCalledWith(broadcastPayload);

        await fin.Application.wrapSync(testIdentity1).quit(true).catch(() => {});
        await fin.Application.wrapSync(testIdentity2).quit(true).catch(() => {});

        // Cleanup
        jest.clearAllMocks();
    });
});
