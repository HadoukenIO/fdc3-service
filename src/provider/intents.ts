import {Context} from '../client/context';
import {Intents} from '../client/intents';

/**
 * General-purpose intent type
 */
export interface Intent<T=string, C extends Context=Context> {
    type: T;
    context: C;
    target?: string;
}

/**
 * Type definition that is used wherever the API expects the name of an intent to be passed.
 *
 * Since applications are free to define their own intents, it is not possible for TypeScript to verify that only valid
 * intent names are passed to the FDC3 API. This type definition is more a hint to the callee, over a plain "string"
 * argument.
 */
export type IntentType = (keyof typeof Intents)|string;
