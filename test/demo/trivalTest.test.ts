import "jest";
import { fdc3ClientPromise, getConnection } from "./utils/connect";
import { Fin } from "hadouken-js-adapter";

it('1+1=2', () => {
    expect(1+1).toBe(2);
});

let fin: Fin;
let fdc3: typeof import("../../src/client/index"); 

describe('create test apps', () => {
    jest.setTimeout(20000);

    beforeAll(async () => {
        fin = await getConnection();
        fdc3 = await fdc3ClientPromise;
    });

    it('create 2 test-apps', async () => {
        await fdc3.open('test-app-1');
        await fdc3.open('test-app-2');
    
        const openWindows = await fin.System.getAllWindows();
    
        const mainWindowIdentities = openWindows.map(w => ({uuid: w.uuid, name: w.mainWindow.name}));
        
        expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-1' && val.uuid === val.name)).toBe(true);
        expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-2' && val.uuid === val.name)).toBe(true);  

        await fin.Window.wrapSync({uuid:'test-app-1',name:'test-app-1'}).close().catch(() => {});
        await fin.Window.wrapSync({uuid:'test-app-2',name:'test-app-2'}).close().catch(() => {});
    });
    it('create 4 test-apps', async () => { 
        await fdc3.open('test-app-1');
        await fdc3.open('test-app-2');
        await fdc3.open('test-app-3');
        await fdc3.open('test-app-4');
    
        const openWindows = await fin.System.getAllWindows();
    
        const mainWindowIdentities = openWindows.map(w => ({uuid: w.uuid, name: w.mainWindow.name}));
        
        expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-1' && val.uuid === val.name)).toBe(true);
        expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-2' && val.uuid === val.name)).toBe(true);  
        expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-3' && val.uuid === val.name)).toBe(true);
        expect(mainWindowIdentities.some((val) => val.uuid === 'test-app-4' && val.uuid === val.name)).toBe(true);  

        await fin.Window.wrapSync({uuid:'test-app-1',name:'test-app-1'}).close().catch(() => {});
        await fin.Window.wrapSync({uuid:'test-app-2',name:'test-app-2'}).close().catch(() => {});
        await fin.Window.wrapSync({uuid:'test-app-1',name:'test-app-3'}).close().catch(() => {});
        await fin.Window.wrapSync({uuid:'test-app-2',name:'test-app-4'}).close().catch(() => {});
    });
});