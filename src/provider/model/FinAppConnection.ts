import {Identity} from 'openfin/_v2/main';

import {SemVer} from '../utils/SemVer';

import {AppConnectionBase} from './AppConnection';
import {ContextChannel} from './ContextChannel';
import {EntityType} from './Environment';
import {LiveApp} from './LiveApp';

export class FinAppConnection extends AppConnectionBase {
    private readonly _identity: Identity;

    constructor(identity: Identity, entityType: EntityType, version: SemVer, liveApp: LiveApp, channel: ContextChannel, entityNumber: number) {
        super(identity, entityType, version, liveApp.appInfo!, liveApp.waitForAppMature(), channel, entityNumber);

        this._identity = identity;
    }

    public get identity(): Readonly<Identity> {
        return this._identity;
    }

    public bringToFront(): Promise<void> {
        // Deliberate no-op
        return Promise.resolve();
    }

    public focus(): Promise<void> {
        // Deliberate no-op
        return Promise.resolve();
    }
}
