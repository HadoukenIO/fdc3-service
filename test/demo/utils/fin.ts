import {connect, Fin} from 'hadouken-js-adapter';

type TestGlobal = NodeJS.Global&{fin?: Fin, PACKAGE_VERSION?: string};
declare const global: TestGlobal;

const connection = connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST'});

export const getFinConnection = async () => connection;

export const fdc3ClientPromise = getFinConnection().then(fin => {
    global.fin = fin;
    global.PACKAGE_VERSION = 'TEST-CLIENT';
    return import('../../../src/client/main');
});
