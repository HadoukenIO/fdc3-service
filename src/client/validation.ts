/**
 * @hidden
 */

/**
 * Helpers for validating objects passed across IAB channels
 */
import {Identity} from 'openfin/_v2/main';

import {Context} from './context';
import {ChannelId} from './contextChannels';

/**
 * Validates the provided Identity and returns an Identity stripped of any extraneous properties
 */
export function parseIdentity(identity: Identity): Identity {
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
        throw new TypeError(`${safeStringify(identity, 'Provided Identity')} is not a valid Identity`);
    }

    return {uuid: identity.uuid, name: identity.name || identity.uuid};
}

/**
 * Validates the provided Context. No properties are stripped, as these are permitted by the FDC3 specification
 */
export function parseContext(context: Context): Context {
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
        throw new TypeError(`${safeStringify(context, 'Provided Context')} is not a valid Context`);
    }

    return context;
}

/**
 * Validates the provided ChannelId
 */
export function parseChannelId(channelId: ChannelId): ChannelId {
    if (typeof channelId !== 'string') {
        throw new TypeError(`${safeStringify(channelId, 'Provided ChannelId')} is not a valid ChannelId`);
    }

    return channelId;
}

/**
 * Validates we're running inside an OpenFin environment
 */
export function validateEnvironment(): void {
    if (typeof fin === 'undefined') {
        throw new Error('fin is not defined. The openfin-fdc3 module is only intended for use in an OpenFin application.');
    }
}

function safeStringify(value: any, fallback: string): string {
    // Provided object may not be stringify-able (e.g., due to circular references), so we need to try-catch
    let result: string;
    try {
        result = JSON.stringify(value);
    } catch (e) {
        result = fallback;
    }

    return result;
}
