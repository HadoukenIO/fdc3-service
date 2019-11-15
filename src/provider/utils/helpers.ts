import {Application} from '../../client/directory';
import {Timeouts} from '../constants';

import {withTimeout} from './async';

export enum ClientCallsResult {
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
 * Takes multiple promises representing API calls, and reduces them to a single result.
 * In the case that more than one promise resolves to a result,
 * the first to return will be used. Intended to be used when calling a client from the provider,
 * to protect against a misbehaving client.
 *
 * @param promises An array of promises
 */
export async function collateClientCalls<T = void>(promises: Promise<T>[]): Promise<[ClientCallsResult, T | undefined]> {
    let successes = 0;
    let failures = 0;

    let result: T | undefined = undefined;

    await Promise.all(promises.map((promise) => withTimeout(Timeouts.SERVICE_TO_CLIENT_API_CALL, promise.then((promiseResult) => {
        if (successes === 0) {
            result = promiseResult;
        }
        if (promiseResult !== undefined) {
            result = promiseResult;
        }
        successes++;
    }, (e) => {
        console.warn(`API call failed with error ${e.message}`);
        failures++;
    }))));

    if (promises.length === 0) {
        return [ClientCallsResult.NO_CALLS, undefined];
    } else if (successes > 0) {
        return [ClientCallsResult.ANY_SUCCESS, result!];
    } else if (failures > 0) {
        return [ClientCallsResult.ALL_FAILURE, undefined];
    } else {
        return [ClientCallsResult.TIMEOUT, undefined];
    }
}
