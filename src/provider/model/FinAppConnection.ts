import {Identity} from 'openfin/_v2/main';

import {AppConnectionBase} from './AppConnection';
import {ContextChannel} from './ContextChannel';
import {EntityType} from './Environment';
import {LiveApp} from './LiveApp';

export class FinAppConnection extends AppConnectionBase {
    private readonly _identity: Identity;

    constructor(identity: Identity, entityType: EntityType, liveApp: LiveApp, channel: ContextChannel, entityCounter: number) {
        super(identity, entityType, liveApp.appInfo!, liveApp.waitForAppMature(), channel, entityCounter);

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
