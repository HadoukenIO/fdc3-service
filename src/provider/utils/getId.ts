import {Identity} from 'openfin/_v2/main';

/**
 * Generates a unique `string` id for a window based on its application's uuid and window name
 */
export function getId(identity: Identity): string {
    return `${identity.uuid}/${identity.name || identity.uuid}`;
}
