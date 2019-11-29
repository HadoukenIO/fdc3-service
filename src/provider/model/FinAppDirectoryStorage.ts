import {Signal} from 'openfin-service-signal';
import {injectable} from 'inversify';

import {AsyncInit} from '../controller/AsyncInit';
import {StoredDirectoryItem} from '../../client/internal';
import {Injector} from '../common/Injector';

import {AppDirectoryStorage} from './AppDirectoryStorage';

const newFin = fin as (typeof fin) & {Storage: any};

@injectable()
export class FinAppDirectoryStorage extends AsyncInit implements AppDirectoryStorage {
    public readonly changed: Signal<[]>;

    private _items: StoredDirectoryItem[];

    public constructor() {
        super();

        this.changed = new Signal();

        this._items = [];
    }

    public getStoredDirectoryItems(): StoredDirectoryItem[] {
        return this._items;
    }

    protected async init(): Promise<void> {
        await fin.System.addListener('storage-changed', (tag: string) => {
            if (tag === 'of-fdc3-service.directory') {
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
            items = await newFin.Storage.getAllItems('of-fdc3-service.directory');
        } catch (e) {
            console.warn('Unable to read directory items from storage');
            items = new Map();
        }

        const entries = Array.from(items.entries());

        const sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0])).map((entry) => entry[1]);
        this._items = sortedEntries.map((entry) => JSON.parse(entry) as StoredDirectoryItem);
    }
}
