import {Signal} from 'openfin-service-signal';
import {injectable} from 'inversify';

import {AsyncInit} from '../controller/AsyncInit';
import {Injector} from '../common/Injector';
import {DirectoryShardMap, DirectoryShard, APP_DIRECTORY_STORAGE_TAG} from '../../client/api/directory';

import {AppDirectoryStorage, DomainAppDirectoryShard, AppDirectoryShard} from './AppDirectoryStorage';

// TODO: Remove once Storage API is in published runtime and types are updated [SERVICE-840]
const newFin = fin as (typeof fin) & {Storage: any};

@injectable()
export class FinAppDirectoryStorage extends AsyncInit implements AppDirectoryStorage {
    public readonly changed: Signal<[]> = new Signal();

    private _shards: DomainAppDirectoryShard[] = [];

    public getDirectoryShards(): DomainAppDirectoryShard[] {
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
        let storageMap: Map<string, string>;

        try {
            // We expect this to throw if no directory items have been written
            storageMap = await newFin.Storage.getAllItems(APP_DIRECTORY_STORAGE_TAG);
        } catch (e) {
            storageMap = new Map();
        }

        const entries = Array.from(storageMap.entries());

        const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0]));
        const shardMaps = sortedEntries.map(([domain, json]) => ({domain, shardMap: JSON.parse(json) as DirectoryShardMap}));

        this._shards = shardMaps.map(({domain, shardMap}) => ({
            domain,
            shard: shardMapToShard(shardMap)
        }));
    }
}

function shardMapToShard(shardMap: DirectoryShardMap): AppDirectoryShard {
    const entries = Object.entries(shardMap);
    const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0])).map(([key, shard]) => shard);

    return sortedEntries.reduce((prev: AppDirectoryShard, curr: DirectoryShard) => {
        prev.storedApplications.push(...curr.storedApplications);
        prev.remoteSnippets.push(...curr.remoteSnippets);

        return prev;
    }, {storedApplications: [], remoteSnippets: []});
}
