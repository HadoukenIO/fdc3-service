/**
 * @module Contexts
 */

/**
 * TypeScript definitions for envelope and context objects.
 *
 * These structures are defined by the Contexts FDC3 working group. he definitions here are based on current
 * proposals and are not final. There may be minor differences between the current spec and the definitions here,
 * in order to support this demo.
 */

/**
 * General-purpose context type
 *
 * A context object is open for extension with any custom properties/metadata.
 */
export interface Context {
    /**
     * The type of the context that uniquely identifies it, e.g. "fdc3.instrument"
     * Used to refer to the accepted context(s) when declaring intents.
     */
    type: string;

    /**
     * The name of the context data (optional).
     * Implementors of context may choose to make the name mandatory.
     */
    name?: string;

    /**
     * An optional map of any equivalent identifiers for the
     * context type, e.g. ISIN, CUSIP, etc. for an instrument.
     */
    id?: {[key: string]: string|undefined;};

    /**
     * A context object is open for extension with any custom properties/metadata.
     */
    [key: string]: unknown;
}

// Built-in contexts
export interface ContactContext extends Context {
    type: 'fdc3.contact';
    name: string;
    id: {[key: string]: string}&{email?: string; twitter?: string; phone?: string};
}
export interface SecurityContext extends Context {
    type: 'fdc3.security';
    id: {[key: string]: string}&{default: string};
}
export interface OrganizationContext extends Context {
    type: 'fdc3.organization';
    id: {[key: string]: string}&{default: string};
}
