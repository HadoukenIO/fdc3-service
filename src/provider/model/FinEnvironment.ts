import {WindowEvent} from 'openfin/_v2/api/events/base';
import {injectable, id} from 'inversify';
import {Identity, Window} from 'openfin/_v2/main';
import {ExternalApplication as OFExternalApplication} from 'openfin/_v2/api/external-application/external-application';
import {Application as OFApplication} from 'openfin/_v2/api/application/application';

import {AsyncInit} from '../controller/AsyncInit';
import {Signal1, Signal2} from '../common/Signal';
import {Application, IntentType, ChannelId, FDC3ChannelEventType} from '../../client/main';
import {FDC3Error, OpenError} from '../../client/errors';
import {deferredPromise, withTimeout} from '../utils/async';
import {Timeouts} from '../constants';
import {parseIdentity} from '../../client/validation';

import {Environment} from './Environment';
import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {getId} from './Model';

interface PendingWindow {
    creationTime: number | undefined;
    index: number;
}

interface IntentMap {
    [key: string]: boolean;
}

interface ContextMap {
    [key: string]: boolean;
}

interface ChannelEventMap {
    [channelId: string]: {[eventId: string]: boolean};
}

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

    private _windowsCreated: number = 0;
    private readonly _pendingWindows: {[id: string]: PendingWindow} = {};

    public async createApplication(appInfo: Application, channel: ContextChannel): Promise<void> {
        const [didTimeout] = await withTimeout(
            Timeouts.APP_START_FROM_MANIFEST,
            fin.Application.startFromManifest(appInfo.manifest).catch(e => {
                throw new FDC3Error(OpenError.ErrorOnLaunch, (e as Error).message);
            })
        );
        if (didTimeout) {
            throw new FDC3Error(OpenError.AppTimeout, `Timeout waiting for app '${appInfo.name}' to start from manifest`);
        }
    }

    public wrapApplication(appInfo: Application, identity: Identity, channel: ContextChannel): AppWindow {
        identity = parseIdentity(identity);
        const id = getId(identity);

        const {creationTime, index} = this._pendingWindows[id];
        delete this._pendingWindows[id];

        return new FinAppWindow(identity, appInfo, channel, creationTime, index);
    }

    public async inferApplication(identity: Identity): Promise<Application> {
        if (this.isExternalWindow(identity)) {
            const application = fin.ExternalApplication.wrapSync(identity.uuid);

            return {
                appId: application.identity.uuid,
                name: application.identity.uuid,
                manifestType: 'openfin',
                manifest: ''
            };
        } else {
            type OFManifest = {
                shortcut?: {name?: string, icon: string},
                startup_app: {uuid: string, name?: string, icon?: string}
            };

            const application = fin.Application.wrapSync(identity);
            const applicationInfo = await application.getInfo();

            const {shortcut, startup_app} = applicationInfo.manifest as OFManifest;

            const title = (shortcut && shortcut.name) || startup_app.name || startup_app.uuid;
            const icon = (shortcut && shortcut.icon) || startup_app.icon;

            return {
                appId: application.identity.uuid,
                name: application.identity.uuid,
                title: title,
                icons: icon ? [{icon}] : undefined,
                manifestType: 'openfin',
                manifest: applicationInfo.manifestUrl
            };
        }
    }

    protected async init(): Promise<void> {
        fin.System.addListener('window-created', (event: WindowEvent<'system', 'window-created'>) => {
            const identity = {uuid: event.uuid, name: event.name};

            this.registerWindow(identity, Date.now());
        });
        fin.System.addListener('window-closed', (event: WindowEvent<'system', 'window-closed'>) => {
            const identity = {uuid: event.uuid, name: event.name};

            delete this._pendingWindows[getId(identity)];

            this.windowClosed.emit(identity);
        });

        // Register windows that were running before launching the FDC3 service
        const windowInfo = await fin.System.getAllWindows();

        windowInfo.forEach(info => {
            const {uuid, mainWindow, childWindows} = info;

            this.registerWindow({uuid, name: mainWindow.name}, undefined);
            childWindows.forEach(child => this.registerWindow({uuid, name: child.name}, undefined));
        });
    }

    private async registerWindow(identity: Identity, creationTime: number | undefined): Promise<void> {
        const pendingWindow = {
            creationTime,
            index: this._windowsCreated
        };

        this._pendingWindows[getId(identity)] = pendingWindow;
        this._windowsCreated++;

        const info = await fin.Application.wrapSync(identity).getInfo();
        this.windowCreated.emit(identity, info.manifestUrl);
    }

    private async isExternalWindow(identity: Identity): Promise<boolean> {
        const extendedIdentity = identity as (Identity & {entityType: string | undefined});

        const externalWindowType = 'external connection';

        if (extendedIdentity.entityType) {
            return extendedIdentity.entityType === externalWindowType;
        } else {
            const entityInfo = await fin.System.getEntityInfo(identity.uuid, identity.uuid);

            return entityInfo.entityType === externalWindowType;
        }
    }
}

class FinAppWindow implements AppWindow {
    public channel: ContextChannel;

    private readonly _id: string;
    private readonly _appInfo: Application;
    private readonly _window: Window;
    private readonly _appWindowNumber: number;

    private readonly _creationTime: number | undefined;

    private readonly _intentListeners: IntentMap;
    private readonly _channelContextListeners: ContextMap;
    private readonly _channelEventListeners: ChannelEventMap;

    private readonly _onIntentListenerAdded: Signal1<IntentType> = new Signal1();

    constructor(identity: Identity, appInfo: Application, channel: ContextChannel, creationTime: number | undefined, appWindowNumber: number) {
        this._id = getId(identity);
        this._window = fin.Window.wrapSync(identity);
        this._appInfo = appInfo;
        this._appWindowNumber = appWindowNumber;

        this._creationTime = creationTime;

        this._intentListeners = {};
        this._channelContextListeners = {};
        this._channelEventListeners = {};

        this.channel = channel;
    }

    public get id(): string {
        return this._id;
    }

    public get identity(): Readonly<Identity> {
        return this._window.identity;
    }

    public get appInfo(): Readonly<Application> {
        return this._appInfo;
    }

    public get appWindowNumber(): number {
        return this._appWindowNumber;
    }

    public get channelContextListeners(): ReadonlyArray<ChannelId> {
        return Object.keys(this._channelContextListeners);
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

    public hasChannelContextListener(channel: ContextChannel): boolean {
        return this._channelContextListeners[channel.id] === true;
    }

    public addChannelContextListener(channel: ContextChannel): void {
        this._channelContextListeners[channel.id] = true;
    }

    public removeChannelContextListener(channel: ContextChannel): void {
        delete this._channelContextListeners[channel.id];
    }

    public hasChannelEventListener(channel: ContextChannel, eventType: FDC3ChannelEventType): boolean {
        return this._channelEventListeners[channel.id] && (this._channelEventListeners[channel.id][eventType] === true);
    }

    public addChannelEventListener(channel: ContextChannel, eventType: FDC3ChannelEventType): void {
        if (!this._channelEventListeners[channel.id]) {
            this._channelEventListeners[channel.id] = {};
        }

        this._channelEventListeners[channel.id][eventType] = true;
    }

    public removeChannelEventListener(channel: ContextChannel, eventType: FDC3ChannelEventType): void {
        if (this._channelEventListeners[channel.id]) {
            delete this._channelEventListeners[channel.id][eventType];
        }
    }

    public bringToFront(): Promise<void> {
        return this._window.bringToFront();
    }

    public focus(): Promise<void> {
        return this._window.focus();
    }

    public async isReadyToReceiveIntent(intent: IntentType): Promise<boolean> {
        if (this.hasIntentListener(intent)) {
            // App has already registered the intent listener
            return true;
        }

        const age = this._creationTime === undefined ? undefined : Date.now() - this._creationTime;

        if (age === undefined || age >= Timeouts.ADD_INTENT_LISTENER) {
            // App has been running for a while
            return false;
        } else {
            // App may be starting - Give it some time to initialize and call `addIntentListener()`, otherwise timeout
            const [waitForIntentListenerAddedPromise, resolve] = deferredPromise();

            const slot = this._onIntentListenerAdded.add(intentAdded => {
                if (intentAdded === intent) {
                    resolve();
                }
            });

            const [didTimeout] = await withTimeout(Timeouts.ADD_INTENT_LISTENER - age, waitForIntentListenerAddedPromise);

            slot.remove();

            return !didTimeout;
        }
    }
}
