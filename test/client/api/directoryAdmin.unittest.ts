import {Identity} from 'openfin/_v2/main';

import {updateAppDirectory, AppDirectory, APP_DIRECTORY_STORAGE_TAG, StoredDirectoryShardMap, UpdateAppDirectoryMigrationHandler} from '../../../src/client/api/directoryAdmin';
import {createMockFin, createMockApplication, getterMock} from '../../mocks';
import {createFakeIdentity, createFakeApp, createFakeUrl} from '../../demo/utils/fakes';
import {Application} from '../../../src/client/main';

type TestParam = [string, UpdateAppDirectoryMigrationHandler, StoredDirectoryShardMap];

const fin = createMockFin();

const fakeApp1 = createFakeApp();
const fakeApp2 = createFakeApp();
const fakeApp3 = createFakeApp();
const fakeApp4 = createFakeApp();
const fakeApp5 = createFakeApp();
const fakeApp6 = createFakeApp();
const fakeApp7 = createFakeApp();

const fakeUrl1 = createFakeUrl();
const fakeUrl2 = createFakeUrl();
const fakeUrl3 = createFakeUrl();
const fakeUrl4 = createFakeUrl();
const fakeUrl5 = createFakeUrl();
const fakeUrl6 = createFakeUrl();

const populatedDirectoryVersion = 4;

const defaultDirectory = {
    'default-namespace': {
        version: 1,
        remoteSnippets: [],
        storedApplications: []
    }
};

const populatedDirectory = {
    'namespace-namespace-1': {
        version: 3,
        remoteSnippets: [fakeUrl1, fakeUrl2, fakeUrl3],
        storedApplications: [fakeApp1, fakeApp2, fakeApp3]
    },
    'namespace-namespace-2': {
        version: populatedDirectoryVersion,
        remoteSnippets: [fakeUrl4, fakeUrl5, fakeUrl6],
        storedApplications: [fakeApp4, fakeApp5, fakeApp6]
    }
};

beforeEach(() => {
    jest.resetAllMocks();

    getterMock(fin.Application, 'me').mockReturnValue(createFakeIdentity());

    fin.Application.wrapSync.mockImplementation((identity: Identity) => {
        const mockApplication = createMockApplication();
        getterMock(mockApplication, 'identity').mockReturnValue(identity);

        mockApplication.getInfo.mockResolvedValue({initialOptions: {}} as any);

        return mockApplication;
    });
});

describe('When the app directory is empty', () => {
    beforeEach(() => {
        fin.Storage.getItem.mockRejectedValue(undefined);
    });

    const testParams: TestParam[] = [
        ['We can read the version of the app directory', (directory: AppDirectory) => {
            expect(directory.sourceVersion).toEqual(0);
        }, defaultDirectory],

        ['We can read the remote snippets of the app directory', (directory: AppDirectory) => {
            expect(directory.remoteSnippets.source).toEqual([]);
        }, defaultDirectory],

        ['We can add to the remote snippets of the app directory by single value', (directory: AppDirectory) => {
            directory.remoteSnippets.add(fakeUrl1);
        }, createDefaultDirectoryWithRemoteSnippets([fakeUrl1])],

        ['We can add to the remote snippets of the app directory by array', (directory: AppDirectory) => {
            directory.remoteSnippets.add([fakeUrl1, fakeUrl2]);
        }, createDefaultDirectoryWithRemoteSnippets([fakeUrl1, fakeUrl2])],

        ['We can remove remote snippets from the app directory by single value', (directory: AppDirectory) => {
            directory.remoteSnippets.add([fakeUrl1, fakeUrl2]);
            directory.remoteSnippets.remove(fakeUrl1);
        }, createDefaultDirectoryWithRemoteSnippets([fakeUrl2])],

        ['We can remove remote snippets from the app directory by array', (directory: AppDirectory) => {
            directory.remoteSnippets.add([fakeUrl1, fakeUrl2, fakeUrl3]);
            directory.remoteSnippets.remove([fakeUrl1, fakeUrl3]);
        }, createDefaultDirectoryWithRemoteSnippets([fakeUrl2])],

        ['We can set remote snippets of the app directory', (directory: AppDirectory) => {
            directory.remoteSnippets.add([fakeUrl1, fakeUrl2]);
            directory.remoteSnippets.set([fakeUrl3, fakeUrl4]);
        }, createDefaultDirectoryWithRemoteSnippets([fakeUrl3, fakeUrl4])],

        ['We can remove all remote snippets from the app directory', (directory: AppDirectory) => {
            directory.remoteSnippets.add([fakeUrl1, fakeUrl2]);
            directory.remoteSnippets.removeAll();
        }, defaultDirectory],

        ['We can read the stored applications of the app directory', (directory: AppDirectory) => {
            expect(directory.storedApplications.source).toEqual([]);
        }, defaultDirectory],

        ['We can add to the stored applications of the app directory by single value', (directory: AppDirectory) => {
            directory.storedApplications.add(fakeApp1);
        }, createDefaultDirectoryWithStoredApplications([fakeApp1])],

        ['We can add to the stored applications of the app directory by array', (directory: AppDirectory) => {
            directory.storedApplications.add([fakeApp1, fakeApp2]);
        }, createDefaultDirectoryWithStoredApplications([fakeApp1, fakeApp2])],

        ['We can remove the stored applications of the app directory by single object value', (directory: AppDirectory) => {
            directory.storedApplications.add([fakeApp1, fakeApp2]);
            directory.storedApplications.remove(fakeApp1);
        }, createDefaultDirectoryWithStoredApplications([fakeApp2])],

        ['We can remove the stored applications of the app directory by array of objects', (directory: AppDirectory) => {
            directory.storedApplications.add([fakeApp1, fakeApp2, fakeApp3]);
            directory.storedApplications.remove([fakeApp1, fakeApp3]);
        }, createDefaultDirectoryWithStoredApplications([fakeApp2])],

        ['We can remove the stored applications of the app directory by single application name', (directory: AppDirectory) => {
            directory.storedApplications.add([fakeApp1, fakeApp2]);
            directory.storedApplications.remove(fakeApp1.name);
        }, createDefaultDirectoryWithStoredApplications([fakeApp2])],

        ['We can remove the stored applications of the app directory by array of application names', (directory: AppDirectory) => {
            directory.storedApplications.add([fakeApp1, fakeApp2, fakeApp3]);
            directory.storedApplications.remove([fakeApp1.name, fakeApp3.name]);
        }, createDefaultDirectoryWithStoredApplications([fakeApp2])],

        ['We can set the stored applications of the app directory', (directory: AppDirectory) => {
            directory.storedApplications.add([fakeApp1, fakeApp2]);
            directory.storedApplications.set([fakeApp3, fakeApp4]);
        }, createDefaultDirectoryWithStoredApplications([fakeApp3, fakeApp4])],

        ['We can remove all remote snippets from the app directory', (directory: AppDirectory) => {
            directory.storedApplications.add([fakeApp1, fakeApp2]);
            directory.storedApplications.removeAll();
        }, defaultDirectory]
    ];

    test.each(testParams)('%s', async (
        titleParam: string,
        migrationHandler: UpdateAppDirectoryMigrationHandler,
        expectedAppDirectory: StoredDirectoryShardMap
    ) => {
        await updateAppDirectory(migrationHandler);

        expect(fin.Storage.setItem).toBeCalledWith(APP_DIRECTORY_STORAGE_TAG, JSON.stringify(expectedAppDirectory));
    });

    test('If we attempt to modify the app directory after the migration handler has completed, an error is thrown', async () => {
        let outerDirectory: AppDirectory;

        await updateAppDirectory(async (directory: AppDirectory) => {
            outerDirectory = directory;
        });

        expect(() => {
            outerDirectory.remoteSnippets.add(fakeUrl1);
        }).toThrowError();
    });
});

describe('When the app directory is populated and we specify a namespace', () => {
    beforeEach(() => {
        fin.Storage.getItem.mockResolvedValue(JSON.stringify(populatedDirectory));
    });

    const testParams: TestParam[] = [
        ['We can read the version of the app directory', (directory: AppDirectory) => {
            expect(directory.sourceVersion).toEqual(populatedDirectory['namespace-namespace-2'].version);
        }, populatedDirectory],

        ['We can read the remote snippets of the app directory', (directory: AppDirectory) => {
            expect(directory.remoteSnippets.source).toEqual(populatedDirectory['namespace-namespace-2'].remoteSnippets);
        }, populatedDirectory],

        ['We can read the stored applications of the app directory', (directory: AppDirectory) => {
            expect(directory.storedApplications.source).toEqual(populatedDirectory['namespace-namespace-2'].storedApplications);
        }, populatedDirectory],

        ['We can add to the stored applications of the app directory without modifying another namespaced app directory', (directory: AppDirectory) => {
            directory.storedApplications.add(fakeApp7);
        }, createPopulatedDirectoryWithStoredApplications([fakeApp4, fakeApp5, fakeApp6, fakeApp7])],

        ['We can attempt to add a duplicate stored application and the directory will not be modified', (directory: AppDirectory) => {
            directory.storedApplications.add(fakeApp4);
        }, createPopulatedDirectoryWithStoredApplications([fakeApp4, fakeApp5, fakeApp6])],

        ['We can attempt to remove a stored application not in the app directory and the directory will not modified', (directory: AppDirectory) => {
            directory.storedApplications.remove(fakeApp1);
        }, populatedDirectory]
    ];

    test.each(testParams)('%s', async (
        titleParam: string,
        migrationHandler: UpdateAppDirectoryMigrationHandler,
        expectedAppDirectory: StoredDirectoryShardMap
    ) => {
        await updateAppDirectory(migrationHandler, {namespace: 'namespace-2'});

        expect(fin.Storage.setItem).toBeCalledWith(APP_DIRECTORY_STORAGE_TAG, JSON.stringify(expectedAppDirectory));
    });

    test('We can create an app directory in a new namespace', async () => {
        await updateAppDirectory(() => {}, {
            namespace: 'namespace-3'
        });

        expect(fin.Storage.setItem).toBeCalledWith(APP_DIRECTORY_STORAGE_TAG, JSON.stringify({
            ...populatedDirectory,
            'namespace-namespace-3': {
                version: 1,
                remoteSnippets: [],
                storedApplications: []
            }
        }));
    });

    test('We can update the version of the app directory', async () => {
        await updateAppDirectory(() => {}, {
            namespace: 'namespace-2',
            destinationVersion: populatedDirectoryVersion + 1
        });

        expect(fin.Storage.setItem).toBeCalledWith(APP_DIRECTORY_STORAGE_TAG, JSON.stringify({
            ...populatedDirectory,
            'namespace-namespace-2': {
                ...populatedDirectory['namespace-namespace-2'],
                version: populatedDirectoryVersion + 1
            }
        }));
    });

    test('If the specified version is lower the than version of the app directory, the migration function is not called \
and the directory is not modified', async () => {
        const spy = jest.fn<void, [AppDirectory]>();

        await updateAppDirectory(spy, {
            namespace: 'namespace-2',
            destinationVersion: populatedDirectoryVersion - 1
        });

        expect(spy).not.toBeCalled();
        expect(fin.Storage.setItem).not.toBeCalled();
    });

    test('If the specified max version is lower the than version of the app directory, the migration function is not called \
and the directory is not modified', async () => {
        const spy = jest.fn<void, [AppDirectory]>();

        await updateAppDirectory(spy, {
            namespace: 'namespace-2',
            maxSourceVersion: populatedDirectoryVersion - 1
        });

        expect(spy).not.toBeCalled();
        expect(fin.Storage.setItem).not.toBeCalled();
    });

    test('If the specified max version is equal to version of the app directory, the migration function is called \
and the directory is modified', async () => {
        await updateAppDirectory((directory: AppDirectory) => {
            directory.storedApplications.add(fakeApp7);
        }, {
            namespace: 'namespace-2',
            maxSourceVersion: populatedDirectoryVersion
        });

        expect(fin.Storage.setItem).toBeCalledWith(
            APP_DIRECTORY_STORAGE_TAG,
            JSON.stringify(createPopulatedDirectoryWithStoredApplications([fakeApp4, fakeApp5, fakeApp6, fakeApp7]))
        );
    });

    test('If the specified max version is greater than the version of the app directory, the migration function is \
called and the directory is modified', async () => {
        await updateAppDirectory((directory: AppDirectory) => {
            directory.storedApplications.add(fakeApp7);
        }, {
            namespace: 'namespace-2',
            maxSourceVersion: populatedDirectoryVersion + 1
        });

        expect(fin.Storage.setItem).toBeCalledWith(
            APP_DIRECTORY_STORAGE_TAG,
            JSON.stringify(createPopulatedDirectoryWithStoredApplications([fakeApp4, fakeApp5, fakeApp6, fakeApp7]))
        );
    });
});

function createDefaultDirectoryWithRemoteSnippets(remoteSnippets: string[]): StoredDirectoryShardMap {
    return {...defaultDirectory,
        'default-namespace': {
            ...defaultDirectory['default-namespace'],
            remoteSnippets
        }
    };
}

function createDefaultDirectoryWithStoredApplications(storedApplications: Application[]): StoredDirectoryShardMap {
    return {...defaultDirectory,
        'default-namespace': {
            ...defaultDirectory['default-namespace'],
            storedApplications
        }
    };
}

function createPopulatedDirectoryWithStoredApplications(storedApplications: Application[]): StoredDirectoryShardMap {
    return {...populatedDirectory,
        'namespace-namespace-2': {
            ...populatedDirectory['namespace-namespace-2'],
            storedApplications
        }
    };
}
