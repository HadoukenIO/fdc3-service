import "jest";
import { fdc3ClientPromise, getFinConnection } from "./utils/fin";
import { Fin } from "hadouken-js-adapter";
import { browserPromise, getPage } from "./utils/puppeteer";

type TestWindowContext = Window & {
    fin: Fin;
    OpenfinFDC3: typeof import("../../src/client/index")
};

// it('1+1=2', () => {
//     expect(1+1).toBe(2);
// });

// let fin: Fin;
// let fdc3: typeof import("../../src/client/index"); 

// describe('create test apps', () => {
//     jest.setTimeout(20000);

//     beforeAll(async () => {
//         fin = await getFinConnection();
//         fdc3 = await fdc3ClientPromise;
//     });

//     it('create 2 test-apps', async () => {
//         await fdc3.open('test-app-1');
//         await fdc3.open('test-app-2');
    
//         const openWindows = await fin.System.getAllWindows();
    
//         const mainWindowIdentities = openWindows.map(w => ({uuid: w.uuid, name: w.mainWindow.name}));
        
//         expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-1' && val.uuid === val.name)).toBe(true);
//         expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-2' && val.uuid === val.name)).toBe(true);  

//         await fin.Window.wrapSync({uuid:'test-app-1',name:'test-app-1'}).close().catch(() => {});
//         await fin.Window.wrapSync({uuid:'test-app-2',name:'test-app-2'}).close().catch(() => {});
//     });
//     it('create 4 test-apps', async () => { 
//         await fdc3.open('test-app-1');
//         await fdc3.open('test-app-2');
//         await fdc3.open('test-app-3');
//         await fdc3.open('test-app-4');
    
//         const openWindows = await fin.System.getAllWindows();
    
//         const mainWindowIdentities = openWindows.map(w => ({uuid: w.uuid, name: w.mainWindow.name}));
        
//         expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-1' && val.uuid === val.name)).toBe(true);
//         expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-2' && val.uuid === val.name)).toBe(true);  
//         expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-3' && val.uuid === val.name)).toBe(true);
//         expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-4' && val.uuid === val.name)).toBe(true);  

//         await fin.Window.wrapSync({uuid:'test-app-1',name:'test-app-1'}).close().catch(() => {});
//         await fin.Window.wrapSync({uuid:'test-app-2',name:'test-app-2'}).close().catch(() => {});
//         await fin.Window.wrapSync({uuid:'test-app-1',name:'test-app-3'}).close().catch(() => {});
//         await fin.Window.wrapSync({uuid:'test-app-2',name:'test-app-4'}).close().catch(() => {});
//     });
// });

describe('basic puppeteer functionality', () => {
    jest.setTimeout(300000);
    it('can connect to the main test-app', async () => {
        console.log('starting test');
        const browser = await browserPromise;
        expect(browser).toBeTruthy();
        
        // Connect to test-app and get it's identity from it's own context
        const testAppPage = await getPage('test-app');
        expect(testAppPage).toBeTruthy();
        if (!testAppPage) {
            throw new Error('No page found for test-app')
        }
        const identity = await (await testAppPage.evaluateHandle(function(this: TestWindowContext) { return fin.Window.me;})).jsonValue();
        expect(await identity).toEqual({name:'test-app', uuid:'test-app'});

        // Launch two test applications
        await testAppPage.evaluate(async function(this: TestWindowContext): Promise<void> {
            await this.OpenfinFDC3.open('test-app-1');
            await this.OpenfinFDC3.open('test-app-2');
        });

        // Get new test app pages
        const testApp1 = await getPage('test-app-1');
        const testApp2 = await getPage('test-app-2');

        if (!testApp1) {
            throw new Error('No page found for test-app-1');
        }
        if (!testApp2) {
            throw new Error('No page found for test-app-2');
        }
        
        // Register a context listener on app-2
        const contextListenerResultPromise = testApp2.evaluate(async function (this: TestWindowContext) {
            return new Promise(res => {
                const listener = new this.OpenfinFDC3.ContextListener((context) => {
                    //listener.unsubscribe();
                    res(context);
                });
            });
        });

        // Pause slightly to ensure listener is registered
        await new Promise(res => setTimeout(res, 1000));

        const broadcastPayload = {type: 'test-context', name: 'contextName1', id: {name: 'contextID1'}};

        // Send a context on app-1
        await testApp1.evaluate(async function(this: TestWindowContext, payload) {
            return this.OpenfinFDC3.broadcast(payload);
        }, broadcastPayload);

        // Check that the listener received the context with expected value
        const contextResult = await contextListenerResultPromise;
        console.log(`Received: ${JSON.stringify(contextResult)} - Sent: ${JSON.stringify(broadcastPayload)}`);
        await new Promise(res => setTimeout(res, 100));
        expect(contextResult).toEqual(broadcastPayload);

        // Cleanup
        browser.disconnect();
    });
});