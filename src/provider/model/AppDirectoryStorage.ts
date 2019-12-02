import {Signal} from 'openfin-service-signal';

import {StoredAppDirectoryShard} from '../../client/internal';

export interface AppDirectoryStorage {
    readonly changed: Signal<[]>;

    getStoredDirectoryItems(): StoredAppDirectoryShard[];
}
