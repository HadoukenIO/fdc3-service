import {WindowEvent} from 'openfin/_v2/api/events/base';
import {injectable} from 'inversify';
import {Identity, Window} from 'openfin/_v2/main';

import {AsyncInit} from '../controller/AsyncInit';
import {Signal1, Signal2} from '../common/Signal';
import {Application, IntentType} from '../../client/main';

import {Environment} from './Environment';
import {AppWindow, ContextSpec} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {getId} from './Model';

export const INTENT_LISTENER_TIMEOUT = 5000;

@injectable()
export class FinEnvironment extends AsyncInit implements Environment {
    /**
     * Indicates that a new window has been created.
     *
     * When the service first starts, this signal will also be fired for any pre-existing windows.
     *
     * Arguments: (identity: Identity, manifestUrl: string)
     */
    public readonly windowCreated: Signal2<Identity, string> = new Signal2();

    /**
     * Indicates that a window has been closed.
     *
     * Arguments: (identity: Identity)
     */
    public readonly windowClosed: Signal1<Identity> = new Signal1();

    public async createApplication(appInfo: Application): Promise<AppWindow> {
        const app = await fin.Application.startFromManifest(appInfo.manifest);
        return new FinAppWindow(app.identity, appInfo);
    }

    public wrapApplication(appInfo: Application, identity: Identity): AppWindow {
        return new FinAppWindow(identity, appInfo);
    }

    protected async init(): Promise<void> {
        fin.System.addListener('window-created', (event: WindowEvent<'system', 'window-created'>) => {
            const identity = {uuid: event.uuid, name: event.name};
            this.registerWindow(identity);
        });
        fin.System.addListener('window-closed', (event: WindowEvent<'system', 'window-closed'>) => {
            const identity = {uuid: event.uuid, name: event.name};
            this.windowClosed.emit(identity);
        });

        // Register windows that were running before launching the FDC3 service
        const windowInfo = await fin.System.getAllWindows();
        windowInfo.forEach(info => {
            const {uuid, mainWindow, childWindows} = info;

            this.registerWindow({uuid, name: mainWindow.name});
            childWindows.forEach(child => this.registerWindow({uuid, name: child.name}));
        });
    }

    private async registerWindow(identity: Identity): Promise<void> {
        const info = await fin.Application.wrapSync(identity).getInfo();
        this.windowCreated.emit(identity, info.manifestUrl);
    }
}

interface IntentMap {
    [key: string]: boolean;
}

class FinAppWindow {
    private readonly _id: string;
    private readonly _appInfo: Application;
    private readonly _window: Window;

    private readonly _intentListeners: IntentMap;
    private readonly _contexts: ContextSpec[];

    constructor(identity: Identity, appInfo: Application) {
        this._id = getId(identity);
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

    public get contexts(): ReadonlyArray<ContextChannel> {
        return this._contexts;
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

    public focus(): Promise<void> {
        return this._window.setAsForeground();
    }

    public ensureReadyToReceiveIntent(intent: IntentType): Promise<void> {
        if (this._intentListeners[intent]) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            const slot = this._onIntentListenerAdded.add(intentAdded => {
                if (intentAdded === intent) {
                    slot.remove();
                    resolve();
                }
            });
            setTimeout(() => {
                slot.remove();
                reject(new Error(`Timeout waiting for intent listener to be added. intent = ${intent}`));
            }, INTENT_LISTENER_TIMEOUT);
        });
    }
}

