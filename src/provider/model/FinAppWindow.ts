import {Identity, Window} from 'openfin/_v2/main';

import {Application} from '../../client/main';

import {AppConnectionBase} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {EntityType} from './Environment';

export class FinAppWindow extends AppConnectionBase {
    private readonly _window: Window;

    constructor(identity: Identity, appInfo: Application, channel: ContextChannel, creationTime: number | undefined, appWindowNumber: number) {
        super(identity, EntityType.WINDOW, appInfo, channel, creationTime, appWindowNumber);

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
