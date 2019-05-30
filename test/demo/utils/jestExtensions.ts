import 'jest';

declare global {
    namespace jest {
        interface Matchers<R> {
            /**
             * Used to test that an FDC3Error is thrown
             * @param code Assert that the FDC3Error is thrown with a given `code`
             * @param message Optionally, assert that a given error message is returned
             */
            toThrowFDC3Error<R>(code: string, message?: string | RegExp): R;
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
    }
});
