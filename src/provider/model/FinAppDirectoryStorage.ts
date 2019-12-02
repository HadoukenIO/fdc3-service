import {Signal} from 'openfin-service-signal';
import {injectable, inject} from 'inversify';

import {AsyncInit} from '../controller/AsyncInit';
import {StoredAppDirectoryShard, APP_DIRECTORY_STORAGE_TAG} from '../../client/internal';
import {Injector} from '../common/Injector';
import {Inject} from '../common/Injectables';

import {AppDirectoryStorage} from './AppDirectoryStorage';
import {ConfigStoreBinding} from './ConfigStore';

const newFin = fin as (typeof fin) & {Storage: any};

@injectable()
export class FinAppDirectoryStorage extends AsyncInit implements AppDirectoryStorage {
    public readonly changed: Signal<[]>;

    private readonly _configStore: ConfigStoreBinding;

    private _items: StoredAppDirectoryShard[];

    public constructor(@inject(Inject.CONFIG_STORE) configStore: ConfigStoreBinding) {
        super();

        this._configStore = configStore;

        this.changed = new Signal();

        this._items = [];
    }

    public getStoredDirectoryItems(): StoredAppDirectoryShard[] {
        return this._items;
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
        await Injector.initialized;
        await this.refreshFromStorage();

        this.changed.emit();
    }

    private async refreshFromStorage(): Promise<void> {
        let items: Map<string, string>;

        try {
            // We expect this to throw if no directory items have been written
            items = await newFin.Storage.getAllItems(APP_DIRECTORY_STORAGE_TAG);
        } catch (e) {
            items = new Map();
        }

        const entries = Array.from(items.entries());

        const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0])).map((entry) => entry[1]);
        this._items = sortedEntries.map((entry) => JSON.parse(entry) as StoredAppDirectoryShard);
    }
}
