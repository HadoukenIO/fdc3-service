import {Signal} from 'openfin-service-signal';
import {injectable} from 'inversify';

import {AsyncInit} from '../controller/AsyncInit';
import {StoredAppDirectoryShard, APP_DIRECTORY_STORAGE_TAG} from '../../client/internal';
import {Injector} from '../common/Injector';

import {AppDirectoryStorage} from './AppDirectoryStorage';

// TODO: Remove once Storage API is in published runtime and types are updated [SERVICE-840]
const newFin = fin as (typeof fin) & {Storage: any};

@injectable()
export class FinAppDirectoryStorage extends AsyncInit implements AppDirectoryStorage {
    public readonly changed: Signal<[]> = new Signal();

    private _shards: StoredAppDirectoryShard[] = [];

    public getStoredDirectoryShards(): StoredAppDirectoryShard[] {
        return this._shards;
    }

    protected async init(): Promise<void> {
        await newFin.Storage.addListener('storage-changed', (event: {tag: string}) => {
            if (event.tag === APP_DIRECTORY_STORAGE_TAG) {
                this.handleStorageChanged();
            }
        });

        await this.refreshFromStorage();
    }

    private async handleStorageChanged(): Promise<void> {
        // Ensure we don't dispatch any events until the Injector is fully initialized
        await Injector.initialized;
        await this.refreshFromStorage();

        this.changed.emit();
    }

    private async refreshFromStorage(): Promise<void> {
        let shardsMap: Map<string, string>;

        try {
            // We expect this to throw if no directory items have been written
            shardsMap = await newFin.Storage.getAllItems(APP_DIRECTORY_STORAGE_TAG);
        } catch (e) {
            shardsMap = new Map();
        }

        const entries = Array.from(shardsMap.entries());

        const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0])).map((entry) => entry[1]);
        this._shards = sortedEntries.map((entry) => JSON.parse(entry) as StoredAppDirectoryShard);
    }
}
