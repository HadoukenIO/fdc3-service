
/**
 * TypeScript definitions for FDC3-defined intents.
 *
 * These structures are defined by the Intents FDC3 working group. The definitions here are based on current
 * proposals and are not final. There may be minor differences between the current spec and the definitions here,
 * in order to support this demo.
 */

/**
 * Enum that defines the standard set of intents that are defined as part of the FDC3 specification.
 *
 * This enum exists only as a helper, applications may define their own set of constants if they prefer.
 */
export enum Intents {
    DIAL_CALL = 'DialCall',
    SAVE_CONTACT = 'SaveContact',
    SAVE_INSTRUMENT = 'SaveInstrument',
    SHARE_CONTEXT = 'ShareContext',
    START_CALL = 'StartCall',
    START_CHAT = 'StartChat',
    VIEW_CONTACT = 'ViewContact',
    VIEW_CHART = 'ViewChart',
    VIEW_QUOTE = 'ViewQuote',
    VIEW_NEWS = 'ViewNews'
}

/**
 * Type definition that is used wherever the API expects the name of an intent to be passed.
 *
 * Since applications are free to define their own intents, it is not possible for TypeScript to verify that only valid
 * intent names are passed to the FDC3 API. This type definition is more a hint to the callee, over a plain "string"
 * argument.
 */
export type IntentType = (keyof typeof Intents)|Intents|string;
