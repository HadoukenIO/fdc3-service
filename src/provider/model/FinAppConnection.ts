import {Identity, Window} from 'openfin/_v2/main';

import {Application} from '../../client/main';

import {AppConnectionBase} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {EntityType} from './Environment';

export class FinAppConnection extends AppConnectionBase {
    private readonly _identity: Identity;

    constructor(
        identity: Identity,
        entityType: EntityType,
        appInfo: Application,
        channel: ContextChannel,
        creationTime: number | undefined,
        appWindowNumber: number
    ) {
        super(identity, entityType, appInfo, channel, creationTime, appWindowNumber);

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
