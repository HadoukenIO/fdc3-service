
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
 * It is not possible for TypeScript to verify that only valid application names/appIds are passed to the FDC3 API. This type
 * definition is more a hint to the callee, over a plain "string" argument.
 */
export type DirectoryAppId = string;
export type DirectoryAppName = string;

export interface DirectoryAppImage {
    url: string;
    tooltip?: string;
    description?: string;
}

export interface DirectoryIcon {
    icon: string;
}

export interface DirectoryNameValuePair {
    name: string;
    value: string;
}

export interface DirectoryIntent {
    name: string;
    displayName?: string;
    contexts: string[];

    // Sepcification is ambigous on type of customConfig, so leaving as 'any'
    customConfig: any;
}

/**
 * An application in the app directory
 */
export interface DirectoryApplication {
    appId: DirectoryAppId;
    name: DirectoryAppName;
    manifest: string;
    manifestType: string;

    version?: string;
    title?: string;
    tooltip?: string;
    description?: string;
    images?: DirectoryAppImage[];
    contactEmail?: string;
    supportEmail?: string;
    publisher?: string;

    signature?: string;
    icons?: DirectoryIcon[];
    customConfig?: DirectoryNameValuePair[];

    intents?: DirectoryIntent[];
}
