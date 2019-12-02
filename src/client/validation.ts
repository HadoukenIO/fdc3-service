/**
 * @hidden
 */

/**
 * Helpers for validating objects passed across IAB channels
 */
import {Identity} from 'openfin/_v2/main';

import {Context} from './context';
import {ChannelId} from './contextChannels';
import {Application} from './directory';

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
        throw new TypeError(`${safeStringify(identity, 'The provided Identity')} is not a valid Identity`);
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
        throw new TypeError(`${safeStringify(context, 'The provided Context')} is not a valid Context`);
    }

    return context;
}

/**
 * Validates the provided ChannelId
 */
export function parseChannelId(channelId: ChannelId): ChannelId {
    if (typeof channelId !== 'string') {
        throw new TypeError(`${safeStringify(channelId, 'The provided ChannelId')} is not a valid ChannelId`);
    }

    return channelId;
}

/**
 * Validates the provided app channel name
 */
export function parseAppChannelName(name: string): ChannelId {
    if (typeof name !== 'string' || name === '') {
        throw new TypeError(`${safeStringify(name, 'The provided app channel name')} is not a valid app channel name`);
    }

    return name;
}

/**
 * Validates the provided number is an integer
 */
export function parseInteger(number: number): number {
    if (typeof number !== 'number' || isNaN(number) || Math.floor(number) !== number) {
        throw new TypeError(`${safeStringify(number, 'The provided value')} is not a valid integer`);
    }

    return number;
}

/**
 * Validates the provided 'applications' value - can be either a URL or an array of Applications
 */
export function parseAppDirectoryData(data: string | Application[]): string | Application[] {
    if (!((typeof data === 'string' && data !== '') || (data instanceof Array))) {
        throw new TypeError(`${safeStringify(data, 'The provided \'applications\' parameter')} is not a valid 'applications' parameter`);
    }

    return data;
}

/**
 * Validates we're running inside an OpenFin environment
 */
export function validateEnvironment(): void {
    if (typeof fin === 'undefined') {
        throw new Error('fin is not defined. The openfin-fdc3 module is only intended for use in an OpenFin application.');
    }
}

function safeStringify(value: {}, fallback: string): string {
    // Provided object may not be stringify-able (e.g., due to circular references), so we need to try-catch
    let result: string;
    try {
        result = JSON.stringify(value);
    } catch (e) {
        result = fallback;
    }

    return result;
}
