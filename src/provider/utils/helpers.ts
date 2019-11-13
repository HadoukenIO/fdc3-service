import {Application} from '../../client/directory';
import {Timeouts} from '../constants';

import {withTimeout} from './async';

export enum CollateClientCallsResult {
    ANY_SUCCESS,
    ALL_FAILURE,
    TIMEOUT,
    NO_CALLS
}

export function checkCustomConfigField(app: Application, name: string): string | undefined {
    if (app.customConfig) {
        const customField = app.customConfig.find((field) => field.name === name);
        if (customField) {
            return customField.value;
        }
    }
    return undefined;
}

/**
 * Takes multiple promises representing API calls, and reduces them to a single result. In the case that more than one promise resolves to
 * a result, the first to result will be used. Intented to be used when calling a client from the provider, to protect against a
 * misbehaving client.
 *
 * @param promises An array of promises
 */
export async function collateClientCalls<T = void>(promises: Promise<T>[]): Promise<[CollateClientCallsResult, T | undefined]> {
    let successes = 0;
    let failures = 0;

    let result: T;

    await Promise.all(promises.map((promise) => withTimeout(Timeouts.SERVICE_TO_CLIENT_API_CALL, promise.then((promiseResult) => {
        if (successes === 0) {
            result = promiseResult;
        }
        successes++;
    }, () => {
        failures++;
    }))));

    if (promises.length === 0) {
        return [CollateClientCallsResult.NO_CALLS, undefined];
    } else if (successes > 0) {
        return [CollateClientCallsResult.ANY_SUCCESS, result!];
    } else if (failures > 0) {
        return [CollateClientCallsResult.ALL_FAILURE, undefined];
    } else {
        return [CollateClientCallsResult.TIMEOUT, undefined];
    }
}
