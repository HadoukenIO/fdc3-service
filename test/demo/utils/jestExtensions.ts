import 'jest';
import {ChannelId} from '../../../src/client/main';

import {RemoteChannel} from './fdc3RemoteExecution';

declare global {
    namespace jest {
        interface Matchers<R> {
            /**
             * Used to test that an FDC3Error is thrown
             * @param code Assert that the FDC3Error is thrown with a given `code`
             * @param message Optionally, assert that a given error message is returned
             */
            toThrowFDC3Error<R>(code: string, message?: string | RegExp): R;

            /**
             * Used to test that a RemoteChannel represents the expected client-side Channel
             * @param channel An object with optional `id` and `type` properties that if present we expect the channel to match, or the `ChannelId`
             * @param classType The class we expect the channel to be an instance of
             */
            toBeChannel(channel: {id?: ChannelId, type?: string} | ChannelId, classType?: Function): R;
        }
    }
}

expect.extend({
    async toThrowFDC3Error<T = any>(received: Promise<T>, code: string, message?: string | RegExp) {
        try {
            await received;
            return {
                pass: false,
                message: () => 'Expected promise to be rejected'
            };
        } catch (e) {
            if (!e.name || e.name !== 'FDC3Error') {
                return {pass: false, message: () => `Expected to throw an FDC3Error\nBut threw: ${e.name}`};
            }
            if (e.code !== code) {
                return {pass: false, message: () => `Expected to throw an FDC3Error with code '${code}'\nBut got: '${e.code}'`};
            }
            if (message) {
                if (typeof message === 'string' && e.message !== message) {
                    return {pass: false, message: () => `Expected to throw an FDC3Error with message: ${message}\nBut got: ${e.message}`};
                } else if (message instanceof RegExp && !message.test(e.message)) {
                    return {pass: false, message: () => `Expected to throw an FDC3Error with message matching RegExp: ${message}\nBut got: ${e.message}`};
                }
            }
            return {pass: true, message: () => `Expected not to throw an FDC3Error but threw: ${e.toString()}`};
        }
    },

    toBeChannel(receivedChannel: RemoteChannel, expectedChannel: {id?: ChannelId, type?: string} | ChannelId, channelType?: Function) {
        const inflatedExpectedChannel = typeof expectedChannel === 'string' ? {id: expectedChannel} : expectedChannel;

        let pass = true;
        if (inflatedExpectedChannel.id) {
            pass = pass && (receivedChannel.channel.id === inflatedExpectedChannel.id);
        }

        if (inflatedExpectedChannel.type) {
            pass = pass && (receivedChannel.channel.type === inflatedExpectedChannel.type);
        }

        let receivedPrototype: Function;
        if (channelType) {
            receivedPrototype = Object.getPrototypeOf(receivedChannel.channel);
            pass = pass && (receivedPrototype === channelType);
        }

        return {
            pass,
            message: () => {
                const errorLines = [];

                if (inflatedExpectedChannel.id && receivedChannel.channel.id !== inflatedExpectedChannel.id) {
                    errorLines.push(`Expected channel with ID: ${inflatedExpectedChannel.id}\nBut got: ${receivedChannel.channel.id}`);
                }

                if (inflatedExpectedChannel.type && receivedChannel.channel.type !== inflatedExpectedChannel.type) {
                    errorLines.push(`Expected channel with type: ${inflatedExpectedChannel.type}\nBut got: ${receivedChannel.channel.type}`);
                }

                if (channelType && receivedPrototype !== channelType) {
                    errorLines.push(`Expected channel to be instance of: ${channelType.name}\nBut got: ${receivedPrototype.name}`);
                }

                if (!pass) {
                    return errorLines.join('\n');
                } else {
                    if (channelType) {
                        return `Expected channel not to match: ${JSON.stringify(inflatedExpectedChannel)}, with protoype ${receivedPrototype.name}`;
                    } else {
                        return `Expected channel not to match: ${JSON.stringify(inflatedExpectedChannel)}`;
                    }
                }
            }
        };
    }
});
