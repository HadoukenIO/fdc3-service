import {Application as OpenFinApplication} from 'openfin/_v2/main';

import {AppId, Application as DirectoryApplication} from '../client/directory';

export interface AppMetadata {
    /**
     * The application's UUID, as defined by it's app.json file.
     */
    uuid: string;

    /**
     * Name of the application's main window.
     */
    name: string;

    /**
     * The application's ID within the FDC3 application directory
     */
    directoryId: AppId;
}

/**
 * The FDC3 service has to act as a bridge between the "FDC3" and "OpenFin"
 * worlds. This requires a mapping from application ID's within the FDC3
 * directory to/from application UUID's and window names within OpenFin.
 *
 * This store should be updated whenever the service opens an application. It is
 * only at the point where an OpenFin application has just been launched that
 * all the necessary data is available.
 */
export class MetadataStore {
    private appData: {[dirId: string]: AppMetadata};

    constructor() {
        this.appData = {};
    }

    /**
     * Fetches app metadata based upon an FDC3 application ID
     *
     * If no such metadata is available, null will be returned.
     *
     * @param directoryId The ID of an application within the FDC3 directory
     */
    public lookupFromDirectoryId(directoryId: AppId): AppMetadata|null {
        return this.appData[directoryId] || null;
    }

    /**
     * Fetches app metadata based upon an OpenFin application UUID
     *
     * If no such metadata is available, null will be returned.
     *
     * @param uuid The UUID of an OpenFin application
     */
    public lookupFromAppUUID(uuid: string): AppMetadata|null {
        for (const directoryId in this.appData) {
            if (this.appData.hasOwnProperty(directoryId)) {
                const metadata: AppMetadata = this.appData[directoryId];

                if (metadata.uuid === uuid) {
                    return metadata;
                }
            }
        }

        return null;
    }

    /**
     * Maps an FDC3 App Directory ID directly into the corresponding OpenFin UUID.
     *
     * Returns null if the store doesn't contain the relevant metadata. This can
     * also happen if the given FDC3 app isn't an OpenFin application.
     *
     * @param directoryId The FDC3 app ID to map
     */
    public mapDirectoryId(directoryId: AppId): string|null {
        const metadata = this.appData[directoryId];

        return (metadata && metadata.uuid) || null;
    }

    /**
     * Maps an OpenFin UUID directly into the corresponding FDC3 App Directory ID.
     *
     * Returns null if the store doesn't contain the relevant metadata.
     *
     * @param uuid The application UUID to map
     */
    public mapUUID(uuid: string): AppId|null {
        const metadata = this.lookupFromAppUUID(uuid);

        return (metadata && metadata.directoryId) || null;
    }

    /**
     * Whenever the service has an OpenFin application instance and it's
     * corresponding FDC3 record, it should call this method to update the
     * metadata cache. This will link the two records and save the necessary data
     * for future use.
     *
     * @param appData An FDC3 application directory record
     * @param app An OpenFin application that has been created from 'appData'
     */
    public update(appData: DirectoryApplication, app: OpenFinApplication): void {
        if (typeof appData.appId !== 'string') {
            throw new TypeError('Invalid appData passed to MetadataStore. "id" must be a string.');
        }
        if (!this.appData.hasOwnProperty(appData.appId)) {
            this.appData[appData.appId] = {uuid: app.identity.uuid, name: app.identity.uuid, directoryId: appData.appId};
        }
    }
}
