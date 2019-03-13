
/**
 * TypeScript definitions for envelope and context objects.
 *
 * These structures are defined by the Contexts FDC3 working group. he definitions here are based on current
 * proposals and are not final. There may be minor differences between the current spec and the definitions here,
 * in order to support this demo.
 */

/**
 * Union of currently supported context types. 
 * 
 * The inclusion of ContextBase allows the use of any other contexts which implement
 * the specification correctly.
 */
export type Context = SecurityContext | OrganizationContext | ContactContext | ContextBase;

export interface SecurityContext extends ContextBase {
    type: 'security';
    id: {[key: string]: string}&{default: string};
}

export interface OrganizationContext extends ContextBase {
    type: 'organization';
    id: {[key: string]: string}&{default: string};
}

export interface ContactContext extends ContextBase {
    type: 'contact';
    name: string;
    id: {email?: string; twitter?: string; phone?: string};
}

    /**
     * Base object that all contexts must extend.
     * 
     * A context object is open for extension with any custom properties/metadata.
     */
export interface ContextBase {
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
    id?: {
        [k:string]: string | undefined;
    };

    /**
     * A context object is open for extension with any custom properties/metadata.
     */
    [k: string]: any; // tslint:disable-line:no-any
}