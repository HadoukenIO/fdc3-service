/**
 * @module Intents
 */

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
