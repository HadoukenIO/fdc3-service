import 'jest';

import {Application} from 'openfin/_v2/main';

import {Application as DirectoryApplication} from '../../src/client/directory';
import {AppMetadata, MetadataStore} from '../../src/provider/MetadataStore';

const fakeApps: {appData: DirectoryApplication; app: Application}[] = [
    {appData: {appId: '1'}, app: {identity: {uuid: 'test-app-1'}}},
    {appData: {appId: '2'}, app: {identity: {uuid: 'test-app-2'}}},
    {appData: {appId: '3'}, app: {identity: {uuid: 'test-app-3'}}},
    {appData: {appId: '4'}, app: {identity: {uuid: 'test-app-4'}}}
] as {appData: DirectoryApplication; app: Application}[];  // Do an explicit cast for TS. Only need very small sub-set for this test.

beforeEach(() => {
    jest.restoreAllMocks();
});

describe('Given an empty MetadataStore', () => {
    describe('When querying the store', () => {
        // Empty store to be used in query tests
        const store = new MetadataStore();

        it('Returns null on any UUID lookup', () => {
            expect(store.lookupFromAppUUID('some-uuid')).toBeNull();
            expect(store.lookupFromAppUUID('some-other-uuid')).toBeNull();
        });

        it('Returns null on any DirectoryID lookup', () => {
            expect(store.lookupFromDirectoryId('1')).toBeNull();
            expect(store.lookupFromDirectoryId('500')).toBeNull();
        });

        it('Returns null on any UUID reverse-map', () => {
            expect(store.mapUUID('some-uuid')).toBeNull();
            expect(store.mapUUID('some-other-uuid')).toBeNull();
        });

        it('Returns null on DirectoryID reverse-map', () => {
            expect(store.mapDirectoryId('1')).toBeNull();
            expect(store.mapDirectoryId('500')).toBeNull();
        });
    });

    describe('When calling update with no "id" field in appData', () => {
        // Empty store to be used in update tests
        const store = new MetadataStore();
        // Parameters for the call
        const appData = {} as DirectoryApplication;
        const app = {identity: {uuid: 'some-uuid'}} as Application;

        it('The method throws an error', () => {
            expect(() => store.update(appData, app)).toThrowError(TypeError);
        });

        it('The invalid data is not added to the store', () => {
            expect(store.lookupFromAppUUID(app.identity.uuid)).toBeNull();
        });
    });

    describe('When calling update with valid data', () => {
        // Empty store to be used in update tests
        const store = new MetadataStore();

        const {appData, app} = fakeApps[0];
        const expectedMetadata: AppMetadata = {directoryId: appData.appId, uuid: app.identity.uuid, name: app.identity.uuid};

        it('The method returns with no errors', () => {
            expect(() => store.update(appData, app)).not.toThrow();
        });

        it('The store returns the new app\'s metadata when queried by UUID', () => {
            expect(store.lookupFromAppUUID(app.identity.uuid)).toEqual(expectedMetadata);
        });

        it('The store returns the new app\'s metadata when queried by DiretoryID', () => {
            expect(store.lookupFromDirectoryId(appData.appId)).toEqual(expectedMetadata);
        });
    });
});
