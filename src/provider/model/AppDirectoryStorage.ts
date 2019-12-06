import {Signal} from 'openfin-service-signal';

import {Application} from '../../client/main';

export interface AppDirectoryShard {
    remoteSnippets: string[];
    storedApplications: Application[];
}

export interface DomainAppDirectoryShard {
    domain: string;
    shard: AppDirectoryShard;
}

export interface AppDirectoryStorage {
    readonly changed: Signal<[]>;

    getDirectoryShards(): DomainAppDirectoryShard[];
}
