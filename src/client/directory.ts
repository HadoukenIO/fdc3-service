
/**
 * TypeScript definitions for objects returned by the Application Directory.
 *
 * These structures are defined by the App-Directory FDC3 working group. The definitions here are based on current
 * proposals and are not final. There may be minor differences between the current spec and the definitions here,
 * in order to support this demo.
 */

/**
 * Type definition that is used wherever the API expects the name of an application to be passed.
 *
 * It is not possible for TypeScript to verify that only valid application names are passed to the FDC3 API. This type
 * definition is more a hint to the callee, over a plain "string" argument.
 */
export type AppIdentifier = string;

/**
 * An application in the app directory
 */
export interface IApplication {
    id: number;
    name: AppIdentifier;
    title: string;
    manifest_url: string;
    description: string;
    contact_email: string;
    support_email: string;
    signature: string;
    publisher: string;
    icon: string;
    appPage: string;
    images: Array<{url: string}>;

    /**
     * A list of the intents supported by this application.
     *
     * Some intents are defined as part of the FDC3 spec, and applications may also define their own intents.
     */
    intents: string[];
}
