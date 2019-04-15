import {Window, Identity} from 'openfin/_v2/main';

import {Application} from '../../client/main';

import {ContextChannel} from './ContextChannel';

interface IntentSpec {
    name: string;
    context: ContextSpec;
}
interface ContextSpec {
    type: string;
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

    private _intents: IntentSpec[];
    private _contexts: ContextSpec[];

    constructor(identity: Identity, appInfo: Application) {
        this._id = AppWindow.getId(identity);
        this._window = fin.Window.wrapSync(identity);
        this._appInfo = appInfo;

        this._intents = [];
        this._contexts = [];
    }

    public get id(): string {
        return this._id;
    }

    public get identity(): Identity {
        return this._window.identity;
    }

    public get appInfo(): Readonly<Application> {
        return this._appInfo;
    }

    public get intents(): ReadonlyArray<IntentSpec> {
        return this._intents;
    }

    public get contexts(): ReadonlyArray<ContextChannel> {
        return this._contexts;
    }

    public focus(): Promise<void> {
        return this._window.setAsForeground();
    }
}
