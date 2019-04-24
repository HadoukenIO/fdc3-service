import {Window, Identity} from 'openfin/_v2/main';

import {Application, IntentType} from '../../client/main';
import {Signal1} from '../common/Signal';

import {ContextChannel} from './ContextChannel';

interface ContextSpec {
    type: string;
}

interface IntentMap {
    [key: string]: boolean;
}

/**
 * Model object, representing a window that has connected to the service.
 *
 * Only windows that have created intent or context listeners will be represented in this model. If any non-registered
 * window.
 */
export class AppWindow {
    public static getId(identity: Identity): string {
        return `${identity.uuid}/${identity.name || identity.uuid}`;
    }

    private _id: string;
    private _appInfo: Application;
    private _window: Window;

    private _intents: IntentMap;
    private _contexts: ContextSpec[];

    constructor(identity: Identity, appInfo: Application) {
        this._id = AppWindow.getId(identity);
        this._window = fin.Window.wrapSync(identity);
        this._appInfo = appInfo;

        this._intents = {};
        this._contexts = [];
    }

    public readonly intentsModified: Signal1<IntentType> = new Signal1();

    public get id(): string {
        return this._id;
    }

    public get identity(): Identity {
        return this._window.identity;
    }

    public get appInfo(): Readonly<Application> {
        return this._appInfo;
    }

    public get intents(): IntentMap {
        return this._intents;
    }

    public get contexts(): ReadonlyArray<ContextChannel> {
        return this._contexts;
    }

    public focus(): Promise<void> {
        return this._window.setAsForeground();
    }

    public ensureReadyToReceiveIntent(intent: IntentType): Promise<void> {
        if (this._intents[intent]) {
            return Promise.resolve();
        }
        return new Promise(resolve => {
            const slot = this.intentsModified.add(intentSignalled => {
                if (intentSignalled === intent) {
                    slot.remove();
                    resolve();
                }
            });
        });
    }
}
