import {Identity} from 'openfin/_v2/main';

import {Context} from '../context';

/**
 * Validates the provided Identity and returns an Identity stripped of any extraneous properties
 */
export function parseIdentity(identity: Identity): Identity {
    validateIdentityIsWellFormed(identity);

    return {uuid: identity.uuid, name: identity.name || identity.uuid};
}

/**
 * Validates the provided Context. No properties are stripped, as these are permitted by the FDC3 specification
 */
export function parseContext(context: Context): Context {
    validateContextIsWellFormed(context);

    return context;
}

/**
 * Checks that the provided Identity adheres to the `Identity` interface
 */
function validateIdentityIsWellFormed(identity: Identity): void {
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
        throw new TypeError(`${JSON.stringify(identity)} is not a valid Identity`);
    }
}

/**
 * Checks that the provided Context adheres to the `Context` interface
 */
function validateContextIsWellFormed(context: Context): void {
    let error = false;

    if (context === null || typeof context !== 'object') {
        error = true;
    } else {
        const typeCheck = typeof context.type === 'string';
        const nameCheck = !context.name || typeof context.name === 'string';
        const idCheck = !context.id || typeof context.id === 'object';

        if (!typeCheck || !nameCheck || !idCheck) {
            error = true;
        }
    }

    if (error) {
        throw new TypeError(`${JSON.stringify(context)} is not a valid Context`);
    }
}
