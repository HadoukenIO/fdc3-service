import {Identity, Window} from 'openfin/_v2/main';

import {AppConnectionBase} from './AppConnection';
import {ContextChannel} from './ContextChannel';
import {LiveApp} from './LiveApp';
import {EntityType} from './Environment';

export class FinAppWindow extends AppConnectionBase {
    private readonly _window: Window;

    constructor(identity: Identity, entityType: EntityType, liveApp: LiveApp, channel: ContextChannel, entityCounter: number) {
        super(identity, entityType, liveApp.appInfo!, liveApp.waitForAppMature(), channel, entityCounter);

        this._window = fin.Window.wrapSync(identity);
    }

    public get identity(): Readonly<Identity> {
        return this._window.identity;
    }

    public bringToFront(): Promise<void> {
        return this._window.bringToFront();
    }

    public focus(): Promise<void> {
        return this._window.focus();
    }
}
