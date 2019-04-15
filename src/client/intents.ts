/**
 * @module Intents
 */
import {Context, ContactContext} from './context';

/**
 * TypeScript definitions for FDC3-defined intents.
 *
 * These structures are defined by the Intents FDC3 working group. The definitions here are based on current
 * proposals and are not final. There may be minor differences between the current spec and the definitions here,
 * in order to support this demo.
 */

/**
 * General-purpose intent type
 */
export interface Intent<T=string, C extends Context=Context> {
    type: T;
    context: C;
    target?: string;
}

// Built-in intents
export type DialCallIntent = Intent<typeof Intents.DIAL_CALL, ContactContext>;
export type SaveContactIntent = Intent<typeof Intents.SAVE_CONTACT, ContactContext>;

/**
 * Enum that defines the standard set of intents that are defined as part of the FDC3 specification.
 *
 * This enum exists only as a helper, applications may define their own set of constants if they prefer.
 */
export enum Intents {
    DIAL_CALL = 'fdc3.DialCall',
    SAVE_CONTACT = 'fdc3.SaveContact',
    SAVE_INSTRUMENT = 'fdc3.SaveInstrument',
    SHARE_CONTEXT = 'fdc3.ShareContext',
    START_CALL = 'fdc3.StartCall',
    START_CHAT = 'fdc3.StartChat',
    VIEW_CONTACT = 'fdc3.ViewContact',
    VIEW_CHART = 'fdc3.ViewChart',
    VIEW_QUOTE = 'fdc3.ViewQuote',
    VIEW_NEWS = 'fdc3.ViewNews'
}

/**
 * Type definition that is used wherever the API expects the name of an intent to be passed.
 *
 * Since applications are free to define their own intents, it is not possible for TypeScript to verify that only valid
 * intent names are passed to the FDC3 API. This type definition is more a hint to the callee, over a plain "string"
 * argument.
 */
export type IntentType = (keyof typeof Intents)|string;
