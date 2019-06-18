import {AppIdentity, NonDirectoryAppIdentity, DirectoryAppIdentity} from './utils/common';

export const appStartupTime = 30 * 1000;

export const testManagerIdentity: AppIdentity = {uuid: 'test-app', name: 'test-app'};

export const testAppInDirectory1: DirectoryAppIdentity = {
    uuid: 'test-app-1',
    name: 'test-app-1',
    appId: '100'
};

export const testAppInDirectory2: DirectoryAppIdentity = {
    uuid: 'test-app-2',
    name: 'test-app-2',
    appId: '200'
};

export const testAppInDirectory3: DirectoryAppIdentity = {
    uuid: 'test-app-3',
    name: 'test-app-3',
    appId: '300'
};

export const testAppInDirectory4: DirectoryAppIdentity = {
    uuid: 'test-app-4',
    name: 'test-app-4',
    appId: '400'
};

/**
* App in directory, registers listeners right after opening
*/
export const testAppWithPreregisteredListeners1 = {
    uuid: 'test-app-preregistered-1',
    name: 'test-app-preregistered-1',
    appId: '500'
};

/**
* Another app in directory, registers listeners right after opening
*/
export const testAppWithPreregisteredListeners2 = {
    uuid: 'test-app-preregistered-2',
    name: 'test-app-preregistered-2',
    appId: '600'
};

/**
 * App not registered in directory
 */
export const testAppNotInDirectory1: NonDirectoryAppIdentity = {
    uuid: 'test-app-not-in-directory-1',
    name: 'test-app-not-in-directory-1',
    manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory-1.json'
};

/**
 * Another app not registered in directory
 */
export const testAppNotInDirectory2: NonDirectoryAppIdentity = {
    uuid: 'test-app-not-in-directory-2',
    name: 'test-app-not-in-directory-2',
    manifestUrl: 'http://localhost:3923/test/configs/test-app-not-in-directory-2.json'
};

/**
 * App that doesn't import the FDC3 library
 */
export const testAppNotFdc3: NonDirectoryAppIdentity = {
    uuid: 'test-app-not-fdc3',
    name: 'test-app-not-fdc3',
    manifestUrl: 'http://localhost:3923/test/configs/test-app-not-fdc3.json'
};
