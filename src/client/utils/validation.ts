/**
 * @hidden
 */

import {Identity} from 'openfin/_v2/main';

/**
 * Validates the provided identity and returns an identity stripped of any extraneous properties
 */
export function parseIdentity(identity: Identity): Identity {
    validateIdentityIsWellFormed(identity);

    return {uuid: identity.uuid, name: identity.name || identity.uuid};
}

/**
 * Checks that the provided identity adheres to the `Identity` interface
 */
export function validateIdentityIsWellFormed(identity: Identity): void {
    let error = false;

    if (identity === null || typeof identity !== 'object') {
        error = true;
    } else {
        const uuidCheck = typeof identity.uuid === 'string';
        const nameCheck = !identity.name || typeof identity.name === 'string';

        if (!uuidCheck || !nameCheck) {
            error = true;
        }
    }

    if (error) {
        // Provided object may not be stringify-able (e.g., due to circular references), so we need to try-catch
        let stringifiedIdentity: string;
        try {
            stringifiedIdentity = JSON.stringify(identity);
        } catch (e) {
            stringifiedIdentity = 'Provided Identity';
        }

        throw new TypeError(`${stringifiedIdentity} is not a valid Identity`);
    }
}
