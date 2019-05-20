import {Window, Identity} from 'openfin/_v2/main';

import {Application, IntentType} from '../../client/main';
import {FDC3Error, OpenError, withTimeout, Timeouts} from '../../client/errors';
import {deferredPromise} from '../../client/internal';
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
    /**
     * Generates a unique `string` id for a window based on its application's uuid and window name
     * @param identity
     */
    public static getId(identity: Identity): string {
        return `${identity.uuid}/${identity.name || identity.uuid}`;
    }

    private readonly _id: string;
    private readonly _appInfo: Application;
    private readonly _window: Window;

    private readonly _intentListeners: IntentMap;
    private readonly _contexts: ContextSpec[];

    constructor(identity: Identity, appInfo: Application) {
        this._id = AppWindow.getId(identity);
        this._window = fin.Window.wrapSync(identity);
        this._appInfo = appInfo;

        this._intentListeners = {};
        this._contexts = [];
    }

    private readonly _onIntentListenerAdded: Signal1<IntentType> = new Signal1();

    public get id(): string {
        return this._id;
    }

    public get identity(): Identity {
        return this._window.identity;
    }

    public get appInfo(): Readonly<Application> {
        return this._appInfo;
    }

    public addIntentListener(intentName: string): void {
        this._intentListeners[intentName] = true;
        this._onIntentListenerAdded.emit(intentName);
    }

    public removeIntentListener(intentName: string): void {
        delete this._intentListeners[intentName];
    }

    public hasAnyIntentListener() {
        return Object.keys(this._intentListeners).length > 0;
    }

    public get contexts(): ReadonlyArray<ContextChannel> {
        return this._contexts;
    }

    public focus(): Promise<void> {
        return this._window.setAsForeground();
    }

    public async ensureReadyToReceiveIntent(intent: IntentType): Promise<void> {
        if (this._intentListeners[intent]) {
            // App has already registered the intent listener
            return Promise.resolve();
        }

        // App may be starting - Give it some time to initialize and call `addIntentListener()`, otherwise timeout
        const [waitForIntentListenerAddedPromise, resolve] = deferredPromise();
        const slot = this._onIntentListenerAdded.add(intentAdded => {
            if (intentAdded === intent) {
                slot.remove();
                resolve();
            }
        });

        const [didTimeout] = await withTimeout(Timeouts.ADD_INTENT_LISTENER, waitForIntentListenerAddedPromise);

        if (didTimeout) {
            slot.remove();
            throw new FDC3Error(OpenError.AppTimeout, `Timeout waiting for intent listener to be added. intent = ${intent}`);
        }
    }
}
