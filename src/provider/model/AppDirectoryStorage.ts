import {Signal} from 'openfin-service-signal';

import {StoredAppDirectoryShard} from '../../client/internal';

export interface DomainAppDirectoryShard {
    domain: string;
    shard: StoredAppDirectoryShard;
}

export interface AppDirectoryStorage {
    readonly changed: Signal<[]>;

    getDirectoryShards(): DomainAppDirectoryShard[];
}
