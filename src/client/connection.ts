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

import {DeferredPromise} from 'openfin-service-async';
import {ChannelClient} from 'openfin/_v2/api/interappbus/channel/client';

import {APIFromClientTopic, SERVICE_CHANNEL, SERVICE_IDENTITY, APIFromClient, deserializeError, Events, OpenFinChannelConnectionEvent} from './internal';
import {EventRouter} from './EventRouter';

/**
 * The version of the NPM package.
 *
 * Webpack replaces any instances of this constant with a hard-coded string at build time.
 */
declare const PACKAGE_VERSION: string;

/**
 * The event emitter to emit events received from the service.  All addEventListeners will tap into this.
 */
export const eventEmitter = new EventEmitter();
let eventRouter: EventRouter<Events>|null;

export function getEventRouter(): EventRouter<Events> {
    if (!eventRouter) {
        eventRouter = new EventRouter(eventEmitter);
    }

    return eventRouter;
}

/**
 * Promise to the channel object that allows us to connect to the client
 */
let channelPromise: Promise<ChannelClient> | null = null;
const hasDOMContentLoaded = new DeferredPromise<void>();

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initialize();
    });
}

function initialize() {
    hasDOMContentLoaded.resolve();
    if (typeof fin !== 'undefined') {
        getServicePromise();

        fin.InterApplicationBus.Channel.onChannelDisconnect((event: OpenFinChannelConnectionEvent) => {
            const {uuid, name, channelName} = event;
            if (uuid === SERVICE_IDENTITY.uuid && name === SERVICE_IDENTITY.name && channelName === SERVICE_CHANNEL) {
                channelPromise = null;
            }
        });
    } else {
        channelPromise = Promise.reject(new Error('fin is not defined. The openfin-fdc3 module is only intended for use in an OpenFin application.'));
    }
}

export async function getServicePromise(): Promise<ChannelClient> {
    await hasDOMContentLoaded.promise;
    if (!channelPromise) {
        if (fin.Window.me.uuid === SERVICE_IDENTITY.uuid && fin.Window.me.name === SERVICE_IDENTITY.name) {
            // Currently a runtime bug when provider connects to itself. Ideally the provider would never import a file
            // that includes this, but for now it is easier to put a guard in place.
            channelPromise = Promise.reject<ChannelClient>(new Error('Trying to connect to provider from provider'));
        } else {
            channelPromise = fin.InterApplicationBus.Channel.connect(SERVICE_CHANNEL, {
                wait: true,
                payload: {version: PACKAGE_VERSION}
            }).then(async (channel: ChannelClient) => {
                // @ts-ignore Timestamp channel creation time for debugging
                channel['timestamp'] = (new Date()).toUTCString();
                // Register service listeners
                channel.register('WARN', (payload: unknown) => console.warn(payload));  // tslint:disable-line:no-any

                // Any unregistered action will simply return false
                channel.setDefaultAction(() => false);

                return channel;
            });
        }
    }

    return channelPromise;
}

/**
 * Wrapper around service.dispatch to help with type checking
 *
 * @param action String identifying the call being made to the provider
 * @param payload Object containing additional arguments
 */
export async function tryServiceDispatch<T extends APIFromClientTopic>(action: T, payload: APIFromClient[T][0]): Promise<APIFromClient[T][1]> {
    const channel: ChannelClient = await getServicePromise();
    return (channel.dispatch(action, payload) as Promise<APIFromClient[T][1]>)
        .catch((error) => {
            throw deserializeError(error);
        });
}
