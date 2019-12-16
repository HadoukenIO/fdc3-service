/**
 * @hidden
 */

/**
 * Helpers for validating objects passed across IAB channels.
 */
import {Identity} from 'openfin/_v2/main';

import {Context} from './types/context';
import {ChannelId} from './api/contextChannels';
import {Application} from './types/directory';

/**
 * Validates and returns the provided app channel name.
 */
export function sanitizeAppChannelName(name: string): ChannelId {
    try {
        return sanitizeNonEmptyString(name);
    } catch (e) {
        throw new TypeError(`${safeStringify(name, 'The provided value')} is not a valid app channel name`);
    }
}

/**
 * Validates and returns the provided Application.
 */
export function sanitizeApplication(application: Application): Application {
    if (application === null || typeof application !== 'object') {
        throw new TypeError(`${safeStringify(application, 'The provided value')} is not a valid Application`);
    }

    return application;
}

/**
 * Validates and returns the provided ChannelId.
 */
export function sanitizeChannelId(channelId: ChannelId): ChannelId {
    if (typeof channelId !== 'string') {
        throw new TypeError(`${safeStringify(channelId, 'The provided value')} is not a valid ChannelId`);
    }

    return channelId;
}

/**
 * Validates and returns the provided Context. No properties are stripped, as these are permitted by the FDC3 specification.
 */
export function sanitizeContext(context: Context): Context {
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
        throw new TypeError(`${safeStringify(context, 'The provided value')} is not a valid Context`);
    }

    return context;
}

/**
 * Validates we're running inside an OpenFin environment
 */
export function validateEnvironment(): void {
    if (typeof fin === 'undefined') {
        throw new Error('fin is not defined. The openfin-fdc3 module is only intended for use in an OpenFin application.');
    }
}

/**
 * Validates and returns the provided function
 */
export function sanitizeFunction<T, U extends any[]>(value: (...args: U) => T): (...args: U) => T {
    if (typeof value !== 'function') {
        throw new TypeError(`${safeStringify(value, 'The provided value')} is not a valid function`);
    }

    return value;
}

/**
 * Validates the provided Identity and returns an Identity stripped of any extraneous properties.
 */
export function sanitizeIdentity(identity: Identity): Identity {
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
        throw new TypeError(`${safeStringify(identity, 'The provided value')} is not a valid Identity`);
    }

    return {uuid: identity.uuid, name: identity.name || identity.uuid};
}

/**
 * Validates and returns the provided string. Will throw if the string is empty
 */
export function sanitizeNonEmptyString(value: string): ChannelId {
    if (typeof value !== 'string' || value === '') {
        throw new TypeError(`${safeStringify(value, 'The provided value')} is not a non-empty string`);
    }

    return value;
}

/**
 * Validates and returns the provided number. Will throw if the number is not a positive integer.
 */
export function sanitizePositiveInteger(value: number): number {
    if (typeof value !== 'number' || isNaN(value) || Math.floor(value) !== value || value < 1) {
        throw new TypeError(`${safeStringify(value, 'The provided value')} is not a valid positive integer`);
    }

    return value;
}

export function safeStringify(value: {}, fallback: string): string {
    // Provided object may not be stringify-able (e.g., due to circular references), so we need to try-catch
    let result: string;
    try {
        result = JSON.stringify(value);
    } catch (e) {
        result = fallback;
    }

    return result;
}
