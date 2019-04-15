/**
 * @module Directory
 */

/**
 * TypeScript definitions for objects returned by the Application Directory.
 *
 * These structures are defined by the App-Directory FDC3 working group. The definitions here are based on the 1.0.0
 * specification which can be found at https://fdc3.finos.org/appd-spec
 */

/**
 * Type definitions that is are wherever the API expects the ID or of an application to be passed. We have both, since
 * internally appId is used to identify app, but externally we use name to repsect specification
 *
 * It is not possible for TypeScript to verify that only valid application names/appIds are passed
 * to the FDC3 API. This type definition is more a hint to the callee, over a plain "string" argument.
 */
export type AppId = string;
export type AppName = string;

/**
 * An application in the app directory
 */
export interface Application {
    appId: AppId;
    name: AppName;
    manifest: string;
    manifestType: string;

    version?: string;
    title?: string;
    tooltip?: string;
    description?: string;
    images?: AppImage[];
    contactEmail?: string;
    supportEmail?: string;
    publisher?: string;

    signature?: string;
    icons?: Icon[];
    customConfig?: NameValuePair[];

    intents?: Intent[];
}

interface AppImage {
    url: string;
    tooltip?: string;
    description?: string;
}
interface Icon {
    icon: string;
}

interface NameValuePair {
    name: string;
    value: string;
}

interface Intent {
    name: string;
    displayName?: string;
    contexts: string[];

    // Specification is ambiguous on type of customConfig, so leaving as 'any'
    /* tslint:disable:no-any */
    customConfig: any;
}
