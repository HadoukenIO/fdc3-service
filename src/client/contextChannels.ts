/**
 * @module ContextChannels
 */

import {Identity} from 'openfin/_v2/main';

import {parseIdentity} from '../common/validation';

import {tryServiceDispatch} from './connection';
import {APIFromClientTopic, DesktopChannelTransport, ChannelTransport} from './internal';

export type ChannelId = string;

export type Channel = DesktopChannel|DefaultChannel;

/**
 * Event fired whenever a window changes channel. See {@link addEventListener}.
 *
 * This event can be used to track all channel changes, rather than listening only to a specific channel.
 *
 * @event 'channel'
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
 * Object representing a context channel.
 *
 * All interactions with a context channel happen through the methods on here.
 */
abstract class ChannelBase {
    /**
     * Constant that uniquely identifies this channel. Will be generated by the service, and guarenteed to be unique
     * within the set of channels registered with the service.
     *
     * In the case of `desktop` channels (see {@link DesktopChannel}), these IDs _should_ persist across sessions. The
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
     * @throws `FDC3Error`: If `identity` is not a valid {@link https://developer.openfin.co/docs/javascript/stable/global.html#Identity | Identity}
     * @throws `FDC3Error`: If the window specified by `identity` does not exist
     * @throws `FDC3Error`: If the window specified by `identity` does not integrate FDC3 (determined by inclusion of the client API module)
     */
    public async join(identity?: Identity): Promise<void> {
        return tryServiceDispatch(APIFromClientTopic.CHANNEL_JOIN, {id: this.id, identity: identity && parseIdentity(identity)});
    }
}

/**
 * User-facing channels, to display within a color picker or channel selector component.
 *
 * This list of channels should be considered fixed by applications - the service will own the list of user channels,
 * making the same list of channels available to all applications, and this list will not change over the lifecycle of
 * the service.
 *
 * We do not intend to support creation of 'user' channels at runtime, as this would add considerable complexity when
 * implementing a channel selector component, as it would need to support a dynamic channel list
 */
export class DesktopChannel extends ChannelBase {
    public readonly type!: 'desktop';

    /**
     * A user-readable name for this channel, e.g: `"Red"`
     */
    public readonly name: string;

    /**
     * The color that should be associated within this channel when displaying this channel in a UI, e.g: `0xFF0000`.
     */
    public readonly color: number;

    public constructor(transport: DesktopChannelTransport) {
        super(transport.id, 'desktop');

        this.name = transport.name;
        this.color = transport.color;
    }
}

/**
 * All windows will start off in this channel.
 *
 * Unlike desktop channels, the default channel has no pre-defined name or visual style. It is up to apps to display
 * this in the channel selector as they see fit - it could be as "default", or "none", or by "leaving" a user channel.
 */
export class DefaultChannel extends ChannelBase {
    public readonly type!: 'default';

    public constructor() {
        super(DEFAULT_CHANNEL_ID, 'default');
    }
}

export const DEFAULT_CHANNEL_ID: ChannelId = 'default';

/**
 * The channel in which all windows will initially be placed.
 *
 * All windows will belong to exactly one channel at all times. If they have not explicitly
 * been placed into a channel via a {@link Channel.join} call, they will be in this channel.
 *
 * If an app wishes to leave a desktop channel it can do so by (re-)joining this channel.
 */
export const defaultChannel: DefaultChannel = new DefaultChannel();

const channelLookup: {[id: string]: Channel} = {
    [DEFAULT_CHANNEL_ID]: defaultChannel
};

/**
 * Gets all user-visible channels.
 *
 * This is the list of channels that should be used to populate a channel selector. All channels returned will have
 * additional metadata that can be used to populate a selector UI with a consistent cross-app channel list.
 */
export async function getDesktopChannels(): Promise<DesktopChannel[]> {
    const channelTransports = await tryServiceDispatch(APIFromClientTopic.GET_DESKTOP_CHANNELS, {});

    return channelTransports.map(getChannelObject) as DesktopChannel[];
}

/**
 * Fetches a channel object for a given channel identifier. The `channelId` property maps to the {@link Channel.id} field.
 *
 * @param channelId The ID of the channel to return
 * @throws `FDC3Error`: If the channel specified by `channelId` does not exist
 */
export async function getChannelById(channelId: ChannelId): Promise<Channel> {
    const channelTransport = await tryServiceDispatch(APIFromClientTopic.GET_CHANNEL_BY_ID, {id: channelId});

    return getChannelObject(channelTransport);
}

/**
 * Returns the channel that the current window is assigned to.
 *
 * @param identity The window to query. If omitted, will use the window that calls this method.
 * @throws `FDC3Error`: If `identity` is not a valid {@link https://developer.openfin.co/docs/javascript/stable/global.html#Identity | Identity}
 * @throws `FDC3Error`: If the window specified by `identity` does not exist
 * @throws `FDC3Error`: If the window specified by `identity` does not integrate FDC3 (determined by inclusion of the client API module)
 */
export async function getCurrentChannel(identity?: Identity): Promise<Channel> {
    const channelTransport = await tryServiceDispatch(APIFromClientTopic.GET_CURRENT_CHANNEL, {identity: identity && parseIdentity(identity)});

    return getChannelObject(channelTransport);
}

export function getChannelObject<T extends Channel = Channel>(channelTransport: ChannelTransport): T {
    let channel: Channel = channelLookup[channelTransport.id];

    if (!channel) {
        switch (channelTransport.type) {
            case 'default':
                channel = defaultChannel;
                break;
            case 'desktop':
                channel = new DesktopChannel(channelTransport as DesktopChannelTransport);
                channelLookup[channelTransport.id] = channel;
        }
    }

    return channel as T;
}
