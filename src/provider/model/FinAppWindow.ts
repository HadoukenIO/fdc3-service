import {Identity, Window} from 'openfin/_v2/main';

import {AbstractAppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {LiveApp} from './LiveApp';

export class FinAppWindow extends AbstractAppWindow {
    private readonly _window: Window;

    constructor(identity: Identity, liveApp: LiveApp, channel: ContextChannel, appWindowNumber: number) {
        super(identity, liveApp.appInfo!, liveApp.waitForAppMature(), channel, appWindowNumber);

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
