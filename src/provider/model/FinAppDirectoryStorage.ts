import {Signal} from 'openfin-service-signal';
import {injectable, inject} from 'inversify';

import {AsyncInit} from '../controller/AsyncInit';
import {APP_DIRECTORY_STORAGE_TAG, StoredAppDirectoryShard} from '../../client/internal';
import {Injector} from '../common/Injector';
import {Inject} from '../common/Injectables';

import {AppDirectoryStorage, ScopedAppDirectoryShard, ShardScope} from './AppDirectoryStorage';
import {ConfigStoreBinding} from './ConfigStore';

// TODO: Remove once Storage API is in published runtime and types are updated [SERVICE-840]
const newFin = fin as (typeof fin) & {Storage: any};

@injectable()
export class FinAppDirectoryStorage extends AsyncInit implements AppDirectoryStorage {
    public readonly changed: Signal<[]> = new Signal();

    private _shards: ScopedAppDirectoryShard[] = [];
    private _globalShard: ScopedAppDirectoryShard | undefined;

    private readonly _configStore: ConfigStoreBinding;

    public constructor(@inject(Inject.CONFIG_STORE) configStore: ConfigStoreBinding) {
        super();

        this._configStore = configStore;
    }

    public getDirectoryShards(): ScopedAppDirectoryShard[] {
        return this._shards;
    }

    protected async init(): Promise<void> {
        await this._configStore.initialized;

        await newFin.Storage.addListener('storage-changed', (event: {tag: string}) => {
            if (event.tag === APP_DIRECTORY_STORAGE_TAG) {
                this.handleStorageChanged();
            }
        });

        const configUrl = this._configStore.config.query({level: 'desktop'}).applicationDirectory;

        if (configUrl) {
            this._globalShard = {
                scope: {type: 'global'},
                shard: {urls: [configUrl], applications: []}
            };
        }

        await this.refreshFromStorage();
    }

    private async handleStorageChanged(): Promise<void> {
        // Ensure we don't dispatch any events until the Injector is fully initialized
        await Injector.initialized;
        await this.refreshFromStorage();

        this.changed.emit();
    }

    private async refreshFromStorage(): Promise<void> {
        this._shards = this._globalShard ? [this._globalShard] : [];

        let shardsMap: Map<string, string>;

        try {
            // We expect this to throw if no directory items have been written
            shardsMap = await newFin.Storage.getAllItems(APP_DIRECTORY_STORAGE_TAG);
        } catch (e) {
            shardsMap = new Map();
        }

        const entries = Array.from(shardsMap.entries());

        const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0]));
        this._shards.push(...sortedEntries.map(([domain, json]) => ({
            scope: {type: 'domain', domain} as ShardScope,
            shard: JSON.parse(json) as StoredAppDirectoryShard
        })));
    }
}
