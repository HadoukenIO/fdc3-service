import {connect, Fin} from 'hadouken-js-adapter';
const connection = connect({address: `ws://localhost:${process.env.OF_PORT}`, uuid: 'TEST'});

export const getConnection = async () => connection;

export const fdc3ClientPromise = getConnection().then(fin => {
    (global as NodeJS.Global & {fin: Fin}).fin = fin;
    (global as NodeJS.Global & {PACKAGE_VERSION: string}).PACKAGE_VERSION = 'TEST-CLIENT';
    return import('../../../src/client/index');
});