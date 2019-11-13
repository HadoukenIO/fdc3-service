import 'jest';
import * as diff from 'jest-diff';

import {ChannelId, Context as FDC3Context} from '../../../src/client/main';

import {RemoteChannel} from './RemoteChannel';
import {RemoteContextListener} from './fdc3RemoteExecution';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace jest {
        interface Matchers<R, T> {
            /**
             * Used to test that an FDC3Error is thrown
             * @param code Assert that the FDC3Error is thrown with a given `code`
             * @param message Optionally, assert that a given error message is returned
             */
            toThrowFDC3Error(code: string, message?: string | RegExp): Promise<R>;

            /**
             * Used to test that a RemoteChannel represents the expected client-side Channel
             * @param channel An object with optional `id` and `type` properties that if present we expect the channel to match, or the `ChannelId`
             * @param classType The class we expect the channel to be an instance of
             */
            toBeChannel(channel: {id?: ChannelId; type?: string} | ChannelId, classType?: Function): R;

            /**
             * Used to test that a remote listener has received the provided contexts
             * @param contexts The expected contexts
             */
            toHaveReceivedContexts(contexts: FDC3Context[]): Promise<R>;
        }
    }
}

expect.extend({
    async toThrowFDC3Error<T>(promiseOrFunction: Promise<T> | (() => T), code: string, message?: string | RegExp): Promise<jest.CustomMatcherResult> {
        try {
            if (promiseOrFunction instanceof Promise) {
                await promiseOrFunction;
            } else {
                promiseOrFunction();
            }
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

    toBeChannel(channel: RemoteChannel, expectedChannel: {id?: ChannelId; type?: string} | ChannelId, channelType?: Function): jest.CustomMatcherResult {
        const inflatedExpectedChannel = typeof expectedChannel === 'string' ? {id: expectedChannel} : expectedChannel;

        let pass = true;
        if (inflatedExpectedChannel.id) {
            pass = pass && (channel.channel.id === inflatedExpectedChannel.id);
        }

        if (inflatedExpectedChannel.type) {
            pass = pass && (channel.channel.type === inflatedExpectedChannel.type);
        }

        let receivedPrototype: Function;
        if (channelType) {
            receivedPrototype = Object.getPrototypeOf(channel.channel);
            pass = pass && (receivedPrototype === channelType);
        }

        return {
            pass,
            message: () => {
                const errorLines: string[] = [];

                if (inflatedExpectedChannel.id && channel.channel.id !== inflatedExpectedChannel.id) {
                    errorLines.push(`Expected channel with ID: ${inflatedExpectedChannel.id}\nBut got: ${channel.channel.id}`);
                }

                if (inflatedExpectedChannel.type && channel.channel.type !== inflatedExpectedChannel.type) {
                    errorLines.push(`Expected channel with type: ${inflatedExpectedChannel.type}\nBut got: ${channel.channel.type}`);
                }

                if (channelType && receivedPrototype !== channelType) {
                    errorLines.push(`Expected channel to be instance of: ${channelType.name}\nBut got: ${receivedPrototype.name}`);
                }

                if (!pass) {
                    return errorLines.join('\n');
                } else if (channelType) {
                    return `Expected channel not to match: ${JSON.stringify(inflatedExpectedChannel)}, with protoype ${receivedPrototype.name}`;
                } else {
                    return `Expected channel not to match: ${JSON.stringify(inflatedExpectedChannel)}`;
                }
            }
        };
    },

    async toHaveReceivedContexts(
        listener: RemoteContextListener | jest.Mock<any, FDC3Context[]>,
        expectedContexts: FDC3Context[]
    ) {
        let receivedContexts: FDC3Context[] = [];
        if ('mock' in listener) {
            receivedContexts = (listener as jest.Mock<any, FDC3Context[]>).mock.calls.reduce((prev, current) => {
                return [...prev, ...current];
            }, []);
        } else {
            receivedContexts = await (listener as RemoteContextListener).getReceivedContexts();
        }

        const pass = this.equals(receivedContexts, expectedContexts);

        const message = () => {
            if (pass) {
                return `Expected not to receive contexts ${this.utils.printReceived(expectedContexts)}`;
            } else {
                return `Expected to receive contexts: ${this.utils.printExpected(expectedContexts)}\n\
But received contexts: ${this.utils.printReceived(receivedContexts)}\n\
Difference:\n${diff(expectedContexts, receivedContexts)}`;
            }
        };

        return {message, pass};
    }
});
