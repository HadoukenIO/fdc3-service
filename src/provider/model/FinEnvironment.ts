import {WindowEvent} from 'openfin/_v2/api/events/base';
import {injectable} from 'inversify';
import {Identity, Window} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {AsyncInit} from '../controller/AsyncInit';
import {Application, IntentType, ChannelId} from '../../client/main';
import {FDC3Error, OpenError} from '../../client/errors';
import {withTimeout} from '../utils/async';
import {Timeouts} from '../constants';
import {parseIdentity} from '../../client/validation';
import {DeferredPromise} from '../common/DeferredPromise';
import {Events, ChannelEvents} from '../../client/internal';
import {Injector} from '../common/Injector';

import {Environment, EntityType} from './Environment';
import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {getId} from './Model';

interface SeenWindow {
    creationTime: number | undefined;
    index: number;
}

type IntentMap = Set<string>;

type ContextMap = Set<string>;

type ChannelEventMap = Map<string, Set<Events['type']>>;

@injectable()
export class FinEnvironment extends AsyncInit implements Environment {
    /**
     * Indicates that a window has been seen by the service.
     *
     * Unlike the `windowCreated` signal, this will be fired synchronously from the listener for the runtime window-created event,
     * but does not provide all information provided by the `windowCreated` signal. For a given window, this will always be fired
     * before the `windowCreated` signal.
     *
     * Arguments: (identity: Identity)
     */
    public readonly windowSeen: Signal<[Identity]> = new Signal();

    /**
     * Indicates that a new window has been created.
     *
     * When the service first starts, this signal will also be fired for any pre-existing windows.
     *
     * Arguments: (identity: Identity, manifestUrl: string)
     */
    public readonly windowCreated: Signal<[Identity, string]> = new Signal();

    /**
     * Indicates that a window has been closed.
     *
     * Arguments: (identity: Identity)
     */
    public readonly windowClosed: Signal<[Identity]> = new Signal();

    private _windowsCreated: number = 0;
    private readonly _seenWindows: {[id: string]: SeenWindow} = {};

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

        const seenWindow = this._seenWindows[id] || {creationTime: 0, index: this._windowsCreated++};
        const {creationTime, index} = seenWindow;

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

    public async getEntityType(identity: Identity): Promise<EntityType> {
        const entityInfo = await fin.System.getEntityInfo(identity.uuid, identity.uuid);

        return entityInfo.entityType as EntityType;
    }

    public isWindowSeen(identity: Identity): boolean {
        return !!this._seenWindows[getId(identity)];
    }

    protected async init(): Promise<void> {
        // Register windows that were running before launching the FDC3 service
        const windowInfo = await fin.System.getAllWindows();

        fin.System.addListener('window-created', async (event: WindowEvent<'system', 'window-created'>) => {
            await Injector.initialized;
            const identity = {uuid: event.uuid, name: event.name};
            this.registerWindow(identity, Date.now());
        });
        fin.System.addListener('window-closed', async (event: WindowEvent<'system', 'window-closed'>) => {
            await Injector.initialized;
            const identity = {uuid: event.uuid, name: event.name};

            delete this._seenWindows[getId(identity)];

            this.windowClosed.emit(identity);
        });

        // No await here otherwise the injector will never properly initialize - The injector awaits this init before completion!
        Injector.initialized.then(async () => {
            windowInfo.forEach(info => {
                const {uuid, mainWindow, childWindows} = info;

                this.registerWindow({uuid, name: mainWindow.name}, undefined);
                childWindows.forEach(child => this.registerWindow({uuid, name: child.name}, undefined));
            });
        });
    }

    private async registerWindow(identity: Identity, creationTime: number | undefined): Promise<void> {
        const seenWindow = {
            creationTime,
            index: this._windowsCreated
        };

        this._seenWindows[getId(identity)] = seenWindow;
        this._windowsCreated++;

        this.windowSeen.emit(identity);

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

    private readonly _onIntentListenerAdded: Signal<[IntentType]> = new Signal();

    constructor(identity: Identity, appInfo: Application, channel: ContextChannel, creationTime: number | undefined, appWindowNumber: number) {
        this._id = getId(identity);
        this._window = fin.Window.wrapSync(identity);
        this._appInfo = appInfo;
        this._appWindowNumber = appWindowNumber;

        this._creationTime = creationTime;

        this._intentListeners = new Set();
        this._channelContextListeners = new Set();
        this._channelEventListeners = new Map();

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
        return this._intentListeners.has(intentName);
    }

    public addIntentListener(intentName: string): void {
        this._intentListeners.add(intentName);
        this._onIntentListenerAdded.emit(intentName);
    }

    public removeIntentListener(intentName: string): void {
        this._intentListeners.delete(intentName);
    }

    public hasChannelContextListener(channel: ContextChannel): boolean {
        return this._channelContextListeners.has(channel.id);
    }

    public addChannelContextListener(channel: ContextChannel): void {
        this._channelContextListeners.add(channel.id);
    }

    public removeChannelContextListener(channel: ContextChannel): void {
        this._channelContextListeners.delete(channel.id);
    }

    public hasChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): boolean {
        return this._channelEventListeners.has(channel.id) && (this._channelEventListeners.get(channel.id)!.has(eventType));
    }

    public addChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): void {
        if (!this._channelEventListeners.has(channel.id)) {
            this._channelEventListeners.set(channel.id, new Set());
        }

        this._channelEventListeners.get(channel.id)!.add(eventType);
    }

    public removeChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): void {
        if (this._channelEventListeners.has(channel.id)) {
            const events = this._channelEventListeners.get(channel.id)!;
            events.delete(eventType);
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
            const deferredPromise = new DeferredPromise();

            const slot = this._onIntentListenerAdded.add(intentAdded => {
                if (intentAdded === intent) {
                    deferredPromise.resolve();
                }
            });

            const [didTimeout] = await withTimeout(Timeouts.ADD_INTENT_LISTENER - age, deferredPromise.promise);

            slot.remove();

            return !didTimeout;
        }
    }

    public removeAllListeners(): void {
        this._channelContextListeners.clear();
        this._channelEventListeners.clear();
        this._intentListeners.clear();
    }
}
