import {Signal} from 'openfin-service-signal';

import {StoredDirectoryItem} from '../../client/internal';

export interface AppDirectoryStorage {
    readonly changed: Signal<[]>;

    getStoredDirectoryItems(): StoredDirectoryItem[];
}
