import {Signal} from 'openfin-service-signal';

import {Application} from '../../client/main';

export interface AppDirectoryShard {
    urls: string[];
    applications: Application[];
}

export interface DomainAppDirectoryShard {
    domain: string;
    shard: AppDirectoryShard;
}

export interface AppDirectoryStorage {
    readonly changed: Signal<[]>;

    getDirectoryShards(): DomainAppDirectoryShard[];
}
