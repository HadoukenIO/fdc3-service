/**
 * Context channels allow end-user filtering of context broadcasts. Each window is assigned to a particular
 * context channel, and any [[broadcast|broadcasts]] by any window in that channel will only be recevied by the other
 * windows in that channel. The assignment of windows to channels would typically be managed by the user, through
 * either a channel selector widget built into the window itself, or through a separate channel manager application.
 *
 * All windows will initially be placed in the [[defaultChannel|default channel]], and will remain there unless they
 * explicitly [[join]] another channel.
 *
 * There are three types of channels: [[DefaultChannel]], [[SystemChannel]] and [[AppChannel]].
 *
 * @module ContextChannels
 */

/**
 * Contains API definitions for context channels
 */

/* eslint-disable no-dupe-class-members */

import {EventEmitter} from 'events';

import {Identity} from 'openfin/_v2/main';

import {parseIdentity, parseContext, validateEnvironment, parseChannelId, parseAppChannelName} from './validation';
import {tryServiceDispatch, getEventRouter, getServicePromise} from './connection';
import {APIFromClientTopic, APIToClientTopic, ChannelReceiveContextPayload, ChannelEvents, invokeListeners, onReconnect, DEFAULT_CHANNEL_ID} from './internal';
import {Context} from './context';
import {ContextListener} from './main';
import {Transport} from './EventRouter';

/**
 * Type used to identify specific Channels. Though simply an alias of `string`, use of this type indicates use of the string
 * as a channel identifier, and that the user should avoid assuming any internal structure and instead treat as a fully opaque object
 */
export type ChannelId = string;

/**
 * Defines the suggested visual appearance of a system channel when presented in an app, for example, as part of a channel selector.
 */
export interface DisplayMetadata {
    /**
     * A user-readable name for this channel, e.g. `"Red"`
     */
    name: string;

    /**
     * The color that should be associated with this channel when displaying this channel in a UI, e.g. `#FF0000`.
     */
    color: string;

    /**
     * A URL of an image that can be used to display this channel
     */
    glyph: string;
}

/**
 * Union of all possible concrete channel classes that may be returned by the service.
 */
export type Channel = DefaultChannel | SystemChannel | AppChannel;

/**
 * Event fired when a window is added to a channel. See {@link ChannelBase.addEventListener}.
 *
 * Note that this event will typically fire as part of a pair - since windows must always belong to a channel, a window
 * can only join a channel by leaving its previous channel. The exceptions to this rule are when the window is created
 * and destroyed when there will be no previous channel or no current channel, respectively.
 *
 * To listen for channel changes across all (or multiple) channels, there is also a top-level {@link ChannelChangedEvent}.
 *
 * @event
 */
export interface ChannelWindowAddedEvent {
    type: 'window-added';

    /**
     * The window that has just been added to the channel.
     */
    identity: Identity;

    /**
     * The channel that window now belongs to. Will always be the channel object that {@link ChannelBase.addEventListener} was
     * called on.
     */
    channel: Channel;

    /**
     * The channel that the window belonged to previously.
     *
     * Will be `null` if this event is being fired on a newly-created window.
     */
    previousChannel: Channel | null;
}

/**
 * Event fired when a window is removed from a channel. See {@link ChannelBase.addEventListener}.
 *
 * Note that this event will typically fire as part of a pair - since windows must always belong to a channel, a window
 * can only join a channel by leaving it's previous channel. The exceptions to this rule are when the window is created
 * and destroyed when there will be no previous channel or no current channel, respectively.
 *
 * To listen for channel changes across all (or multiple) channels, there is also a top-level {@link ChannelChangedEvent}.
 *
 * @event
 */
export interface ChannelWindowRemovedEvent {
    type: 'window-removed';

    /**
     * The window that has just been removed from the channel.
     */
    identity: Identity;

    /**
     * The channel that the window now belongs to.
     *
     * Will be `null` if the window is leaving the channel due to it being closed.
     */
    channel: Channel | null;

    /**
     * The channel that the window belonged to previously. Will always be the channel object that {@link ChannelBase.addEventListener} was
     * called on.
     */
    previousChannel: Channel;
}

/**
 * Event fired whenever a window changes channel. See {@link addEventListener}.
 *
 * This event can be used to track all channel changes, rather than listening only to a specific channel.
 *
 * See also {@link ChannelWindowAddedEvent}/{@link ChannelWindowRemovedEvent}
 *
 * @event
 */
export interface ChannelChangedEvent {
    type: 'channel-changed';

    /**
     * The window that has switched channel.
     */
    identity: Identity;

    /**
     * The channel that the window now belongs to.
     *
     * Will be `null` if the window has just been closed, and so is being removed from a channel without being added to
     * another.
     */
    channel: Channel|null;

    /**
     * The previous channel that the window belonged to.
     *
     * Will be `null` if the window has just been created, and so doesn't have a previous channel.
     */
    previousChannel: Channel|null;
}

/**
 * Listener for context broadcasts coming from a specific channel. Generated by {@link ChannelBase.addContextListener}.
 */
export interface ChannelContextListener extends ContextListener {
    /**
     * The channel that this listener is observing.
     *
     * Listener will trigger whenever a context is broadcast on this channel.
     */
    channel: Channel;
}

/**
 * @hidden
 */
export interface ChannelTransport {
    id: ChannelId;
    type: string;
}

/**
 * @hidden
 */
export interface SystemChannelTransport extends ChannelTransport {
    type: 'system';
    visualIdentity: DisplayMetadata;
}

/**
 * @hidden
 */
export interface AppChannelTransport extends ChannelTransport {
    type: 'app';
    name: string;
}

/**
 * Class representing a context channel. All interactions with a context channel happen through the methods on here.
 *
 * When users wish to generically handle both {@link SystemChannel}s, {@link AppChannel}s and the
 * {@link DefaultChannel}, generally the {@link Channel} type should be used instead of {@link ChannelBase}.
 */
export abstract class ChannelBase {
    /**
     * Constant that uniquely identifies this channel. Will be generated by the service, and guaranteed to be unique
     * within the set of channels registered with the service.
     *
     * In the case of `system` channels (see {@link SystemChannel}), these IDs _should_ persist across sessions. The
     * channel list is defined by the service, but can be overridden by a desktop owner. If the desktop owner keeps
     * this list static (which is recommended), then IDs will also persist across sessions.
     */
    public readonly id: ChannelId;

    /**
     * Uniquely defines each channel type.
     *
     * See overrides of this class for list of allowed values.
     */
    public readonly type: string;

    protected constructor(id: string, type: string) {
        this.id = id;
        this.type = type;

        channelEventEmitters[id] = new EventEmitter();
    }

    /**
     * Returns a list of all windows belonging to the specified channel.
     *
     * If the window making the call is a member of this channel, it will be included in the results. If there are no
     * windows on this channel, an empty array is returned.
     */
    public async getMembers(): Promise<Identity[]> {
        return tryServiceDispatch(APIFromClientTopic.CHANNEL_GET_MEMBERS, {id: this.id});
    }

    /**
     * Returns the last context that was broadcast on this channel. All channels initially have no context, until a
     * window is added to the channel and then broadcasts. If there is not yet any context on the channel, this method
     * will return `null`. The context is also reset back into its initial context-less state whenever a channel is
     * cleared of all windows.
     *
     * The context of a channel will be captured regardless of how the context is broadcasted on this channel - whether
     * using the top-level FDC3 `broadcast` function, or using the channel-level {@link broadcast} function on this
     * object.
     *
     * NOTE: Only non-default channels are stateful, for the default channel this method will always return `null`.
     */
    public async getCurrentContext(): Promise<Context|null> {
        return tryServiceDispatch(APIFromClientTopic.CHANNEL_GET_CURRENT_CONTEXT, {id: this.id});
    }

    /**
     * Adds the given window to this channel. If no identity is provided, the window making the call will be the window
     * added to the channel.
     *
     * If the channel has a current context (see {@link getCurrentContext}) then that context will be immediately passed to
     * the given window upon joining the channel, via its context listener(s).
     *
     * Note that all windows will always belong to exactly one channel at all times. If you wish to leave a channel,
     * the only way to do so is to join another channel. A window may rejoin the default channel by calling `channels.defaultChannel.join()`.
     *
     * @param identity The window that should be added to this channel. If omitted, will use the window that calls this method.
     * @throws If `identity` is passed, [[FDC3Error]] with an [[ConnectionError]] code.
     * @throws If `identity` is passed, `TypeError` if `identity` is not a valid
     * {@link https://developer.openfin.co/docs/javascript/stable/global.html#Identity | Identity}.
     */
    public async join(identity?: Identity): Promise<void> {
        return tryServiceDispatch(APIFromClientTopic.CHANNEL_JOIN, {id: this.id, identity: identity && parseIdentity(identity)});
    }

    /**
     * Broadcasts the given context on this channel.
     *
     * Note that this function can be used without first joining the channel, allowing applications to broadcast on
     * channels that they aren't a member of.
     *
     * This broadcast will be received by all windows that are members of this channel, *except* for the window that
     * makes the broadcast. This matches the behavior of the top-level FDC3 `broadcast` function.
     *
     * @param context The context to broadcast to all windows on this channel.
     * @throws `TypeError` if `context` is not a valid [[Context]].
     */
    public async broadcast(context: Context): Promise<void> {
        await tryServiceDispatch(APIFromClientTopic.CHANNEL_BROADCAST, {id: this.id, context: parseContext(context)});
    }

    /**
     * Event that is fired whenever a window broadcasts on this channel.
     *
     * This can be triggered by a window belonging to the channel calling the top-level FDC3 `broadcast` function, or by
     * any window calling this channel's {@link broadcast} method.
     *
     * @param handler Function that should be called whenever a context is broadcast on this channel.
     */
    public addContextListener(handler: (context: Context) => void): ChannelContextListener {
        validateEnvironment();

        const listener: ChannelContextListener = {
            channel: this as Channel,
            handler,
            unsubscribe: () => {
                const index: number = channelContextListeners.indexOf(listener);

                if (index >= 0) {
                    channelContextListeners.splice(index, 1);

                    if (!hasChannelContextListener(this.id)) {
                        tryServiceDispatch(APIFromClientTopic.CHANNEL_REMOVE_CONTEXT_LISTENER, {id: this.id});
                    }
                }

                return index >= 0;
            }
        };

        const hasContextListenerBefore = hasChannelContextListener(this.id);
        channelContextListeners.push(listener);

        if (!hasContextListenerBefore) {
            tryServiceDispatch(APIFromClientTopic.CHANNEL_ADD_CONTEXT_LISTENER, {id: this.id});
        }
        return listener;
    }

    /**
     * Event that is fired whenever a window joins this channel. This includes switching to/from the default
     * channel.
     *
     * The event also includes which channel the window was in previously. The `channel` property within the
     * event will always be this channel instance.
     */
    public addEventListener(eventType: 'window-added', handler: (event: ChannelWindowAddedEvent) => void): void;

    /**
     * Event that is fired whenever a window leaves this channel. This includes switching to/from the default
     * channel.
     *
     * The event also includes which channel the window is being added to. The `previousChannel` property within the
     * event will always be this channel instance.
     */
    public addEventListener(eventType: 'window-removed', handler: (event: ChannelWindowRemovedEvent) => void): void;

    /**
     * Subscribes to a particular event. This is not for subscribing to context updates on this channel. Instead, use
     * [[addContextListener]] to receive broadcasts. This is used for events that are raised from a specific channel.
     *
     * See also [[main#addEventListener]], for subscribing to "global" events that are not related to a specific channel.
     *
     * @param eventType The event type.
     * @param handler The handler to call when the event is fired.
     */
    public addEventListener<E extends ChannelEvents>(eventType: E['type'], handler: (event: E) => void): void {
        validateEnvironment();

        const hasEventListenerBefore = channelEventEmitters[this.id].listenerCount(eventType) > 0;
        channelEventEmitters[this.id].addListener(eventType, handler);

        if (!hasEventListenerBefore) {
            tryServiceDispatch(APIFromClientTopic.CHANNEL_ADD_EVENT_LISTENER, {id: this.id, eventType});
        }
    }

    public removeEventListener(eventType: 'window-added', handler: (event: ChannelWindowAddedEvent) => void): void;
    public removeEventListener(eventType: 'window-removed', handler: (event: ChannelWindowRemovedEvent) => void): void;

    /**
     * Unsubscribes from a particular event.
     *
     * Has no effect if `eventType` isn't a valid event, or `handler` isn't a handler registered against `eventType`.
     *
     * @param eventType The event being unsubscribed from.
     * @param handler The handler function to remove.
     */
    public removeEventListener<E extends ChannelEvents>(eventType: E['type'], handler: (event: E) => void): void {
        validateEnvironment();

        channelEventEmitters[this.id].removeListener(eventType, handler);

        if (channelEventEmitters[this.id].listenerCount(eventType) === 0) {
            tryServiceDispatch(APIFromClientTopic.CHANNEL_REMOVE_EVENT_LISTENER, {id: this.id, eventType});
        }
    }
}

/**
 * The channel all windows start in.
 *
 * Unlike system channels, the default channel has no pre-defined name or visual style. It is up to apps to display
 * this in the channel selector as they see fit - it could be as "default", or "none", or by "leaving" a user channel.
 *
 * An instance of the default channel is available from the [[defaultChannel]] getter API.
 */
export class DefaultChannel extends ChannelBase {
    public readonly type!: 'default';

    /**
     * @hidden
     *
     * Channel objects should not be created directly by an application, channel objects should be obtained by calling the relevant APIs.
     */
    public constructor() {
        super(DEFAULT_CHANNEL_ID, 'default');
    }
}

/**
 * User-facing channels, to display within a color picker or channel selector component.
 *
 * This list of channels should be considered fixed by applications - the service will own the list of user channels,
 * making the same list of channels available to all applications, and this list will not change over the lifecycle of
 * the service.
 *
 * To fetch the list of available channels, use [[getSystemChannels]].
 */
export class SystemChannel extends ChannelBase {
    public readonly type!: 'system';

    /**
     * How a client application should present this channel in any UI.
     */
    public readonly visualIdentity: DisplayMetadata;

    /**
     * @hidden
     *
     * Channel objects should not be created directly by an application, channel objects should be obtained by calling the relevant APIs.
     */
    public constructor(transport: SystemChannelTransport) {
        super(transport.id, 'system');

        this.visualIdentity = transport.visualIdentity;
    }
}

/**
 * Custom application-created channels.
 *
 * Applications can create these for specialised use-cases.  These channels should be obtained by name by calling
 * {@link getOrCreateAppChannel} and it is up to your organization to decide how applications are aware of this name.
 * As with organization defined contexts, app channel names should have a prefix specific to your organization to avoid
 * name collisions, e.g. `'company-name.channel-name'`.
 *
 * App channels can be joined by any window, but are only indirectly discoverable if the name is not known.
 */
export class AppChannel extends ChannelBase {
    public readonly type!: 'app';

    /**
     * The name of this channel. This is the same string as is passed to [[getOrCreateAppChannel]].
     */
    public readonly name: string;

    /**
     * @hidden
     *
     * Channel objects should not be created directly by an application, channel objects should be obtained by calling the relevant APIs.
     */
    public constructor(transport: AppChannelTransport) {
        super(transport.id, 'app');

        this.name = transport.name;
    }
}

const channelEventEmitters: {[key: string]: EventEmitter} = {};

/**
 * The channel in which all windows will initially be placed.
 *
 * All windows will belong to exactly one channel at all times. If they have not explicitly been placed into a channel
 * via a {@link ChannelBase.join} call, they will be in this channel.
 *
 * If an app wishes to leave any other channel, it can do so by (re-)joining this channel.
 */
export const defaultChannel: DefaultChannel = new DefaultChannel();

const channelLookup: {[id: string]: Channel} = {
    [DEFAULT_CHANNEL_ID]: defaultChannel
};

const channelContextListeners: ChannelContextListener[] = [];

/**
 * Gets all service-defined system channels.
 *
 * This is the list of channels that should be used to populate a channel selector. All channels returned will have
 * additional metadata that can be used to populate a selector UI with a consistent cross-app channel list.
 */
export async function getSystemChannels(): Promise<SystemChannel[]> {
    const channelTransports = await tryServiceDispatch(APIFromClientTopic.GET_SYSTEM_CHANNELS, {});

    return channelTransports.map(getChannelObject) as SystemChannel[];
}

/**
 * Fetches a channel object for a given channel identifier. The `channelId` property maps to the {@link ChannelBase.id} field.
 *
 * @param channelId The ID of the channel to return
 * @throws [[FDC3Error]] with an [[ChannelError]] code.
 */
export async function getChannelById(channelId: ChannelId): Promise<Channel> {
    const channelTransport = await tryServiceDispatch(APIFromClientTopic.GET_CHANNEL_BY_ID, {id: parseChannelId(channelId)});

    return getChannelObject(channelTransport);
}

/**
 * Returns the channel that the current window is assigned to.
 *
 * @param identity The window to query. If omitted, will use the window that calls this method.
 * @throws If `identity` is passed, [[FDC3Error]] with an [[ConnectionError]] code.
 * @throws If `identity` is passed, `TypeError` if `identity` is not a valid
 * {@link https://developer.openfin.co/docs/javascript/stable/global.html#Identity | Identity}.
 */
export async function getCurrentChannel(identity?: Identity): Promise<Channel> {
    const channelTransport = await tryServiceDispatch(APIFromClientTopic.GET_CURRENT_CHANNEL, {identity: identity && parseIdentity(identity)});

    return getChannelObject(channelTransport);
}

/**
 * Returns an app channel with the given name. Either creates a new channel or returns an existing channel.
 *
 * It is up to your organization to decide how to share knowledge of these custom channels. As with organization
 * defined contexts, app channel names should have a prefix specific to your organization to avoid name collisions,
 * e.g. `'company-name.channel-name'`.
 *
 * The service will assign a unique ID when creating a new app channel, but no particular mapping of name to ID should
 * be assumed.
 *
 * @param name The name of the channel. Must not be an empty string.
 * @throws `TypeError` if `name` is not a valid app channel name, i.e., a non-empty string.
 */
export async function getOrCreateAppChannel(name: string): Promise<AppChannel> {
    const channelTransport = await tryServiceDispatch(APIFromClientTopic.GET_OR_CREATE_APP_CHANNEL, {name: parseAppChannelName(name)});

    return getChannelObject<AppChannel>(channelTransport);
}

function getChannelObject<T extends Channel = Channel>(channelTransport: ChannelTransport): T {
    let channel: Channel = channelLookup[channelTransport.id];

    if (!channel) {
        switch (channelTransport.type) {
            case 'default':
                channel = defaultChannel;
                break;
            case 'system':
                channel = new SystemChannel(channelTransport as SystemChannelTransport);
                channelLookup[channelTransport.id] = channel;
                break;
            case 'app':
                channel = new AppChannel(channelTransport as AppChannelTransport);
                channelLookup[channelTransport.id] = channel;
                break;
        }
    }

    return channel as T;
}

function hasChannelContextListener(id: ChannelId): boolean {
    return channelContextListeners.some((listener) => listener.channel.id === id);
}

function deserializeWindowAddedEvent(eventTransport: Transport<ChannelWindowAddedEvent>): ChannelWindowAddedEvent {
    const identity = eventTransport.identity;
    const channel = getChannelObject(eventTransport.channel);
    const previousChannel = eventTransport.previousChannel ? getChannelObject(eventTransport.previousChannel) : null;
    return {type: 'window-added', identity, channel, previousChannel};
}

function deserializeWindowRemovedEvent(eventTransport: Transport<ChannelWindowRemovedEvent>): ChannelWindowRemovedEvent {
    const identity = eventTransport.identity;
    const channel = eventTransport.channel ? getChannelObject(eventTransport.channel) : null;
    const previousChannel = getChannelObject(eventTransport.previousChannel);
    return {type: 'window-removed', identity, channel, previousChannel};
}

// Keep track of the channel the client is in so it can be rejoined on disconnect
let currentChannel: Channel | null = null;

function deserializeChannelChangedEvent(eventTransport: Transport<ChannelChangedEvent>): ChannelChangedEvent {
    const type = eventTransport.type;
    const identity = eventTransport.identity;
    const channel = eventTransport.channel ? getChannelObject(eventTransport.channel) : null;
    const previousChannel = eventTransport.previousChannel ? getChannelObject(eventTransport.previousChannel) : null;

    if (fin.Window.me.name === identity.name && fin.Window.me.uuid === identity.uuid) {
        currentChannel = channel;
    }

    return {type, identity, channel, previousChannel};
}

if (typeof fin !== 'undefined') {
    const eventHandler = getEventRouter();
    eventHandler.registerEmitterProvider('channel', (channelId: ChannelId) => {
        return channelEventEmitters[channelId];
    });

    eventHandler.registerDeserializer('channel-changed', deserializeChannelChangedEvent);
    eventHandler.registerDeserializer('window-added', deserializeWindowAddedEvent);
    eventHandler.registerDeserializer('window-removed', deserializeWindowRemovedEvent);
    onReconnect.add(async () => {
        await initialize();
        await rehydrate();
    });
    initialize();
}

function initialize(): Promise<void> {
    return getServicePromise().then(async (channelClient) => {
        try {
            channelClient.register(APIToClientTopic.CHANNEL_RECEIVE_CONTEXT, async (payload: ChannelReceiveContextPayload) => {
                await invokeListeners(
                    channelContextListeners.filter((listener) => listener.channel.id === payload.channel),
                    payload.context,
                    (e) => console.warn(`Error thrown by channel context handler, swallowing error. Error message: ${e.message}`),
                    () => new Error('All channel context handlers failed')
                );
            });
        } catch (e) {
            // Trying to resubscribe to the same channel
        }
    }, (reason) => {
        console.warn('Unable to register client channel context handlers. getServicePromise() rejected with reason:', reason);
    });
}

async function rehydrate(): Promise<void> {
    let channelToJoin: Channel = currentChannel || defaultChannel;
    if (channelToJoin.type === 'app') {
        channelToJoin = await getOrCreateAppChannel(channelToJoin.name);
    }
    await channelToJoin.join();
    await Promise.all(channelContextListeners.map(({channel}) => tryServiceDispatch(APIFromClientTopic.CHANNEL_ADD_CONTEXT_LISTENER, {id: channel.id})));
    currentChannel = channelToJoin;
}
