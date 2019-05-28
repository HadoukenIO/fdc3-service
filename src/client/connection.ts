/**
 * @hidden
 */

/**
 * File contains vars used to establish service connection between client and provider.
 *
 * These are separated out from 'internal.ts' as including these from provider code will cause the provider to connect
 * to itself.
 *
 * These types are a part of the client, but are not required by applications wishing to interact with the service.
 * This file is excluded from the public-facing TypeScript documentation.
 */
import {EventEmitter} from 'events';

import {ChannelClient} from 'openfin/_v2/api/interappbus/channel/client';

import {APIFromClientTopic, SERVICE_CHANNEL, SERVICE_IDENTITY, APIFromClient} from './internal';
import {ChannelChangedEvent, ChannelEvent, getChannelById} from './contextChannels';
import {FDC3Error} from './main';

/**
 * The version of the NPM package.
 *
 * Webpack replaces any instances of this constant with a hard-coded string at build time.
 */
declare const PACKAGE_VERSION: string;

/**
 * Defines all events that are fired by the service
 */
export type FDC3Event = ChannelChangedEvent;

/**
 * The event emitter to emit events received from the service.  All addEventListeners will tap into this.
 */
export const eventEmitter = new EventEmitter();

/**
 * Promise to the channel object that allows us to connect to the client
 */
export let channelPromise: Promise<ChannelClient>;
// Currently a runtime bug when provider connects to itself. Ideally the provider would never import a file
// that includes this, but for now it is easier to put a guard in place.
if (fin.Window.me.uuid !== SERVICE_IDENTITY.uuid || fin.Window.me.name !== SERVICE_IDENTITY.name) {
    channelPromise = typeof fin === 'undefined' ?
        Promise.reject(new Error('fin is not defined. The openfin-fdc3 module is only intended for use in an OpenFin application.')) :
        fin.InterApplicationBus.Channel.connect(SERVICE_CHANNEL, {payload: {version: PACKAGE_VERSION}}).then((channel: ChannelClient) => {
            // Register service listeners
            channel.register('WARN', (payload: any) => console.warn(payload));  // tslint:disable-line:no-any
            channel.register('event', async (event: FDC3Event|ChannelEvent) => {
                // Special-handling for some event types, to convert transport-type event to client-side event.
                if (event.type === 'channel-changed') {
                    event.channel = event.channel ? await getChannelById(event.channel.id) : null;
                    event.previousChannel = event.previousChannel ? await getChannelById(event.previousChannel.id) : null;
                }

                eventEmitter.emit(event.type, event);
            });
            // Any unregistered action will simply return false
            channel.setDefaultAction(() => false);

            return channel;
        });
}

/**
 * Wrapper around service.dispatch to help with type checking
 *
 * @param action String identifying the call being made to the provider
 * @param payload Object containing additional arguments
 */
export async function tryServiceDispatch<T extends APIFromClientTopic>(action: T, payload: APIFromClient[T][0]): Promise<APIFromClient[T][1]> {
    const channel: ChannelClient = await channelPromise;
    return (channel.dispatch(action, payload) as Promise<APIFromClient[T][1]>)
        .catch(error => {
            throw FDC3Error.deserialize(error);
        });
}
