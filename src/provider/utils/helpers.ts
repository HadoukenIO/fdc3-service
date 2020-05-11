import {withTimeout} from 'openfin-service-async';

import {Application} from '../../client/directory';
import {Timeouts} from '../constants';

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
 * Takes multiple promises representing API calls, and reduces them to a single result. In the case that more than one promise resolves to a result, the first
 * to return will be used. Intended to be used when calling a client from the provider, to protect against a misbehaving client.
 *
 * @param promises An array of promises
 */
export async function collateClientCalls<T = void>(promises: Promise<T>[]): Promise<[ClientCallsResult, T | undefined]> {
    let successes = 0;
    let failures = 0;

    let result: T | undefined = undefined;

    await Promise.all(promises.map((promise, index) => withTimeout(Timeouts.SERVICE_TO_CLIENT_API_CALL, promise.then((promiseResult) => {
        if (result === undefined && promiseResult !== undefined) {
            result = promiseResult;
        }
        successes++;
    }, (e) => {
        console.warn(`API call with index ${index} failed with error ${e.message}`);
        failures++;
    })).then((withTimeoutResult: [boolean, void | undefined]) => {
        if (withTimeoutResult[0]) {
            console.warn(`API call with index ${index} did not resolve within timeout`);
        }
    })));

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
