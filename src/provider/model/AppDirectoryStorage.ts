import {Signal} from 'openfin-service-signal';

import {StoredAppDirectoryShard} from '../../client/internal';

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
    shard: StoredAppDirectoryShard;
}

export interface AppDirectoryStorage {
    readonly changed: Signal<[]>;

    getDirectoryShards(): ScopedAppDirectoryShard[];
}
