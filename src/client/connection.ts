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
import {ChannelClient} from 'openfin/_v2/api/interappbus/channel/client';

import {APIFromClientTopic, SERVICE_CHANNEL, SERVICE_IDENTITY, APIFromClient, deserializeError} from './internal';

/**
 * The version of the NPM package.
 *
 * Webpack replaces any instances of this constant with a hard-coded string at build time.
 */
declare const PACKAGE_VERSION: string;

/**
 * Promise to the channel object that allows us to connect to the client
 */
let channelPromise: Promise<ChannelClient>|null = null;

if (typeof fin !== 'undefined') {
    getServicePromise();
}

export function getServicePromise(): Promise<ChannelClient> {
    if (!channelPromise) {
        if (typeof fin === 'undefined') {
            channelPromise = Promise.reject(new Error('fin is not defined. The openfin-fdc3 module is only intended for use in an OpenFin application.'));
        } else if (fin.Window.me.uuid === SERVICE_IDENTITY.uuid && fin.Window.me.name === SERVICE_IDENTITY.name) {
            // Currently a runtime bug when provider connects to itself. Ideally the provider would never import a file
            // that includes this, but for now it is easier to put a guard in place.
            channelPromise = Promise.reject<ChannelClient>(new Error('Trying to connect to provider from provider'));
        } else {
            channelPromise = fin.InterApplicationBus.Channel.connect(SERVICE_CHANNEL, {payload: {version: PACKAGE_VERSION}}).then((channel: ChannelClient) => {
                // Register service listeners
                channel.register('WARN', (payload: any) => console.warn(payload));  // tslint:disable-line:no-any

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
        .catch(error => {
            throw deserializeError(error);
        });
}
