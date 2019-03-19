import "jest";
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import { getFinConnection } from "./utils/fin";


describe('advanced puppeteer functionality', () => {
    jest.setTimeout(300000);

    const testManagerIdentity = {uuid: 'test-app', name: 'test-app'};
    const testIdentity1 = {uuid: 'test-app-1', name: 'test-app-1'};
    const testIdentity2 = {uuid: 'test-app-2', name: 'test-app-2'};

    it('can can register and trigger a context listener', async () => {
        const fin = await getFinConnection();

        // Check to see that the main window started correctly
        expect(fin.Application.wrapSync(testManagerIdentity).isRunning()).resolves.toBe(true);
        
        // Launch two test applications
        await fdc3Remote.open(testManagerIdentity, testIdentity1.uuid);
        await fdc3Remote.open(testManagerIdentity, testIdentity2.uuid);
        
        // Check that the apps have started properly
        expect(fin.Application.wrapSync(testIdentity1).isRunning()).resolves.toBe(true);
        expect(fin.Application.wrapSync(testIdentity2).isRunning()).resolves.toBe(true);
        
        const callbackSpy = jest.fn((context) => context);
        await fdc3Remote.addContextListener(testIdentity2, callbackSpy);
        await new Promise(res => setTimeout(res, 100)); // Slight delay to ensure callback is properly registered

        // Send a context on app-1
        const broadcastPayload = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};
        await fdc3Remote.broadcast(testIdentity1, broadcastPayload);

        // Check that the listener received the context with expected value
        await new Promise(res => setTimeout(res, 100));
        expect(callbackSpy).toHaveBeenCalledTimes(1);
        expect(callbackSpy).toHaveBeenCalledWith(broadcastPayload);

        // Cleanup
        jest.clearAllMocks();
    });
});