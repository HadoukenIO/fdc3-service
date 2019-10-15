import {Identity, Window} from 'openfin/_v2/main';

import {Application} from '../../client/main';

import {AbstractAppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';

export class FinAppWindow extends AbstractAppWindow {
    private readonly _window: Window;

    constructor(identity: Identity, appInfo: Application, channel: ContextChannel, maturityPromise: Promise<void>, appWindowNumber: number) {
        super(identity, appInfo, channel, maturityPromise, appWindowNumber);

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
