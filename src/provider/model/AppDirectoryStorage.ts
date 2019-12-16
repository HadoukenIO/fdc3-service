import {Signal} from 'openfin-service-signal';

import {Application} from '../../client/main';

export interface AppDirectoryShard {
    remoteSnippets: string[];
    storedApplications: Application[];
}

export interface GlobalShardScope {
    type: 'global';
}

export interface DomainShardScope {
    type: 'domain';
    domain: string;
}

export type ShardScope = GlobalShardScope | DomainShardScope;

export interface ScopedAppDirectoryShard {
    scope: ShardScope;
    shard: AppDirectoryShard;
}

export interface AppDirectoryStorage {
    readonly changed: Signal<[]>;

    readonly initialized: Promise<void>;

    getDirectoryShards(): ScopedAppDirectoryShard[];
}
