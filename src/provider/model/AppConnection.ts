import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {Application, IntentType, ChannelId} from '../../client/main';
import {withTimeout} from '../utils/async';
import {Timeouts} from '../constants';
import {DeferredPromise} from '../common/DeferredPromise';
import {Events, ChannelEvents} from '../../client/internal';
import {getId} from '../utils/getId';

import {ContextChannel} from './ContextChannel';
import {EntityType} from './Environment';

/**
 * Model interface, representing an entity that has connected to the service.
 *
 * Since an IAB connection is required for an `AppConnection` object to be created, these will only ever refer to FDC3-enabled windows/applications/etc.
 */
export interface AppConnection {
    id: string;
    identity: Identity;
    entityType: EntityType;
    appWindowNumber: number;

    appInfo: Readonly<Application>;
    channel: ContextChannel;

    intentListeners: ReadonlyArray<string>;
    channelContextListeners: ReadonlyArray<ChannelId>;

    hasIntentListener(intentName: string): boolean;
    addIntentListener(intentName: string): void;
    removeIntentListener(intentName: string): void;

    hasContextListener(): boolean;
    addContextListener(): void;
    removeContextListener(): void;

    hasChannelContextListener(channel: ContextChannel): boolean;
    addChannelContextListener(channel: ContextChannel): void;
    removeChannelContextListener(channel: ContextChannel): void;

    hasChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): boolean;
    addChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): void;
    removeChannelEventListener(channel: ContextChannel, eventType: ChannelEvents['type']): void;

    bringToFront(): Promise<void>;
    focus(): Promise<void>;

    isReadyToReceiveIntent(intent: IntentType): Promise<boolean>;
    isReadyToReceiveContext(): Promise<boolean>;

    removeAllListeners(): void;
}

type IntentMap = Set<string>;

type ContextMap = Set<string>;

type ChannelEventMap = Map<string, Set<Events['type']>>;

export abstract class AppConnectionBase implements AppConnection {
    public abstract identity: Readonly<Identity>
    public abstract bringToFront(): Promise<void>;
    public abstract focus(): Promise<void>;

    public channel: ContextChannel;

    private readonly _id: string;
    private readonly _entityType: EntityType;
    private readonly _appInfo: Application;
    private readonly _appWindowNumber: number;

    private readonly _creationTime: number | undefined;

    private readonly _intentListeners: IntentMap;
    private readonly _channelContextListeners: ContextMap;
    private readonly _channelEventListeners: ChannelEventMap;

    private _hasContextListener: boolean;

    private readonly _onIntentListenerAdded: Signal<[IntentType]> = new Signal();
    private readonly _onContextListenerAdded: Signal<[]> = new Signal();

    constructor(
        identity: Identity,
        entityType: EntityType,
        appInfo: Application,
        channel: ContextChannel,
        creationTime: number | undefined,
        appWindowNumber: number
    ) {
        this._id = getId(identity);
        this._entityType = entityType;
        this._appInfo = appInfo;
        this._appWindowNumber = appWindowNumber;

        this._creationTime = creationTime;

        this._intentListeners = new Set();
        this._channelContextListeners = new Set();
        this._channelEventListeners = new Map();

        this._hasContextListener = false;

        this.channel = channel;
    }

    public get id(): string {
        return this._id;
    }

    public get entityType(): EntityType {
        return this._entityType;
    }

    public get appInfo(): Readonly<Application> {
        return this._appInfo;
    }

    public get appWindowNumber(): number {
        return this._appWindowNumber;
    }

    public get channelContextListeners(): ReadonlyArray<ChannelId> {
        return Array.from(this._channelContextListeners.values());
    }

    public get intentListeners(): ReadonlyArray<string> {
        return Array.from(this._intentListeners.values());
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

    public hasContextListener(): boolean {
        return this._hasContextListener;
    }

    public addContextListener(): void {
        this._hasContextListener = true;
        this._onContextListenerAdded.emit();
    }

    public removeContextListener(): void {
        this._hasContextListener = false;
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

    public async isReadyToReceiveContext(): Promise<boolean> {
        if (this.hasContextListener()) {
            // App has already registered the context listener
            return true;
        }

        const age = this._creationTime === undefined ? undefined : Date.now() - this._creationTime;

        if (age === undefined || age >= Timeouts.ADD_CONTEXT_LISTENER) {
            // App has been running for a while
            return false;
        } else {
            // App may be starting - Give it some time to initialize and call `addContextListener()`, otherwise timeout
            const deferredPromise = new DeferredPromise();

            const slot = this._onContextListenerAdded.add(() => {
                deferredPromise.resolve();
            });

            const [didTimeout] = await withTimeout(Timeouts.ADD_CONTEXT_LISTENER - age, deferredPromise.promise);

            slot.remove();

            return !didTimeout;
        }
    }

    public removeAllListeners(): void {
        this._channelContextListeners.clear();
        this._channelEventListeners.clear();
        this._intentListeners.clear();
        this._hasContextListener = false;
    }
}
