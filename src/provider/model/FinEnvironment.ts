import {WindowEvent} from 'openfin/_v2/api/events/base';
import {injectable} from 'inversify';
import {Identity, Window} from 'openfin/_v2/main';

import {AsyncInit} from '../controller/AsyncInit';
import {Signal1, Signal2} from '../common/Signal';
import {Application, IntentType, ContextListener, ChannelId} from '../../client/main';
import {FDC3Error, OpenError, ResolveError, withTimeout, Timeouts} from '../../common/errors';
import {deferredPromise} from '../../common/async';

import {Environment} from './Environment';
import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {getId} from './Model';

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

    public async createApplication(appInfo: Application, channel: ContextChannel): Promise<AppWindow> {
        const [didTimeout, app] = await withTimeout(
            Timeouts.APP_START_FROM_MANIFEST,
            fin.Application.startFromManifest(appInfo.manifest).catch(e => {
                throw new FDC3Error(OpenError.ErrorOnLaunch, (e as Error).message);
            })
        );
        if (didTimeout) {
            throw new FDC3Error(OpenError.AppTimeout, `Timeout waiting for app '${appInfo.name}' to start from manifest`);
        }

        return this.wrapApplication(appInfo, app!.identity, channel);
    }

    public wrapApplication(appInfo: Application, identity: Identity, channel: ContextChannel): AppWindow {
        return new FinAppWindow(identity, appInfo, channel);
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

interface ContextMap {
    [key: string]: boolean;
}

class FinAppWindow {
    private readonly _id: string;
    private readonly _appInfo: Application;
    private readonly _window: Window;

    private readonly _intentListeners: IntentMap;
    private readonly _contextListeners: ContextMap;

    public channel: ContextChannel;

    constructor(identity: Identity, appInfo: Application, channel: ContextChannel) {
        this._id = getId(identity);
        this._window = fin.Window.wrapSync(identity);
        this._appInfo = appInfo;

        this._intentListeners = {};
        this._contextListeners = {};

        this.channel = channel;
    }

    private readonly _onIntentListenerAdded: Signal1<IntentType> = new Signal1();

    public get id(): string {
        return this._id;
    }

    public get identity(): Readonly<Identity> {
        return this._window.identity;
    }

    public get appInfo(): Readonly<Application> {
        return this._appInfo;
    }

    public get contextListeners(): ReadonlyArray<ChannelId> {
        return Object.keys(this._contextListeners);
    }

    public get intentListeners(): ReadonlyArray<string> {
        return Object.keys(this._intentListeners);
    }

    public hasIntentListener(intentName: string): boolean {
        return this._intentListeners[intentName] === true;
    }

    public addIntentListener(intentName: string): void {
        this._intentListeners[intentName] = true;
        this._onIntentListenerAdded.emit(intentName);
    }

    public removeIntentListener(intentName: string): void {
        delete this._intentListeners[intentName];
    }

    public hasContextListener(channelId: ChannelId): boolean {
        return this._contextListeners[channelId] === true;
    }

    public addContextListener(channelId: ChannelId): void {
        this._contextListeners[channelId] = true;
    }

    public removeContextListener(channelId: ChannelId): void {
        delete this._contextListeners[channelId];
    }

    public focus(): Promise<void> {
        return this._window.setAsForeground();
    }

    public async ensureReadyToReceiveIntent(intent: IntentType): Promise<void> {
        if (this.hasIntentListener(intent)) {
            // App has already registered the intent listener
            return;
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
            throw new FDC3Error(ResolveError.IntentTimeout, `Timeout waiting for intent listener to be added. intent = ${intent}`);
        }
    }
}
