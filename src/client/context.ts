/**
 * @module Contexts
 */

/**
 * TypeScript definitions for envelope and context objects.
 *
 * These structures are defined by the Contexts FDC3 working group.
 */

/**
 * General-purpose context type, as defined by [FDC3](https://fdc3.finos.org/docs/1.0/context-intro).
 * A context object is a well-understood datum that is streamable between FDC3 participants. As a result
 * it has a field describing what type it is, and data indicating its identity. Use this as a base
 * to derive your own with any custom properties or metadata.
 */
export interface Context {
    /**
     * The type of the context that uniquely identifies it, e.g. "fdc3.instrument".
     * This is used to refer to the accepted context(s) when declaring intents. See [[AppDirIntent]].
     */
    type: string;

    /**
     * The name of the context data (optional). This is a text string that describes the data being sent.
     * Implementors of context may choose to make the name mandatory.
     */
    name?: string;

    /**
     * An optional map of any equivalent identifiers for the
     * context type, e.g. ISIN, CUSIP, etc. for an instrument.
     */
    id?: {[key: string]: string|undefined;};

    /**
     * @hidden
     * Custom properties and metadata. This can be extended in specific context object.
     */
    [key: string]: unknown;
}

/**
 * Built-in context to define a contact.
 */
export interface ContactContext extends Context {
    /**
     * The context type is always 'fdc3.contact'.
     */
    type: 'fdc3.contact';
    /**
     * Free text name of the contact.
     */
    name: string;
    /**
     * The contact data. Can contain some or all of:
     * * email address,
     * * Twitter handle,
     * * and phone number.
     */
    id: {[key: string]: string}&{email?: string; twitter?: string; phone?: string};
}

/**
 * Built-in context to define a financial instrument.
 */
export interface InstrumentContext extends Context {
    /**
     * The context type is always 'fdc3.instrument'.
     */
    type: 'fdc3.instrument';
    /**
     * Optional free text name of the instrument.
     */
    name?: string;
    /**
     * The instrument data. Can contain some or all of:
     * * a ticker,
     * * an [ISIN](https://www.isin.org/isin/),
     * * a [CUSIP](https://www.cusip.com/cusip/index.htm),
     * * a [SEDOL](https://www.londonstockexchange.com/products-and-services/reference-data/sedol-master-file/sedol-master-file.htm),
     * * a [Reuters Instrument Code (RIC)](https://en.wikipedia.org/wiki/Reuters_Instrument_Code),
     * * a [Bloomberg Ticker](https://www.bloomberg.com/professional/product/market-data/),
     * * a [PERMID](https://permid.org/),
     * * and a [FIGI](https://www.openfigi.com/about/figi).
     */
    id: {[key: string]: string}&{ticker?: string; ISIN?: string; CUSIP?: string; SEDOL?: string;
        RIC?: string; BBG?: string; PERMID?: string; FIGI?: string;};
}

/**
 * Built-in context to define an organization.
 */
export interface OrganizationContext extends Context {
    /**
     * The context type is always fdc3.organization.
     */
    type: 'fdc3.organization';
    /**
     * Optional free text name of the organization.
     */
    name?: string;
    /**
     * The organization data. Can contain either or both
     * * an [LEI](https://www.gleif.org/en/about-lei/introducing-the-legal-entity-identifier-lei)
     * * and a [PERMID](https://permid.org/).
     */
    id: {[key: string]: string}&{LEI?: string; PERMID?: string};
}
