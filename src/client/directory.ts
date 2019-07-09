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
 * Type alias to indicate when an Application Identifier should be passed. Application Identifiers
 * are described [here](https://fdc3.finos.org/docs/1.0/appd-discovery#application-identifier).
 *
 * This type alias exists to disambiguate raw string app identity from the [[AppName]].
 */
export type AppId = string;
/**
 * Type alias to indicate when an Application Name should be passed. This will be a human-readable
 * name that will be displayed on screen.
 *
 * This type alias exists to disambiguate raw string app identity from the [[AppId]].
 */
export type AppName = string;

/**
 * An application in the app directory.
 */
export interface Application {
    /**
     * The Application Identifier. Please see https://fdc3.finos.org/docs/1.0/appd-discovery#application-identifier.
     */
    appId: AppId;
    /**
     * The human readable app name.
     */
    name: AppName;
    /**
     * An application manifest, used to launch the app. This should be a URL that points to an OpenFin json manifest.
     */
    manifest: string;
    /**
     * The manifest type. Always 'openfin'.
     */
    manifestType: string;
    /**
     * The version of the app. Please use [semantic versioning](https://en.wikipedia.org/wiki/Software_versioning).
     */
    version?: string;
    /**
     * The human-readable title of the app, typically used by the launcher UI. If not provided, the name is used.
     */
    title?: string;
    /**
     * Tooltip used by any UIs that display app information. A short explanatory text string.
     */
    tooltip?: string;
    /**
     * Longer description of the app.
     */
    description?: string;
    /**
     * Images that can be displayed as part of the app directory entry. Use these for screenshots, previews or similar. These are not the
     * application icons: use 'icons' for that.
     */
    images?: AppImage[];
    /**
     * Contact email address.
     */
    contactEmail?: string;
    /**
     * Support email address.
     */
    supportEmail?: string;
    /**
     * Name of the publishing company, organization, or individual.
     */
    publisher?: string;
    /**
     * Icons used in the app directory display. A launcher may be able to use various sizes.
     */
    icons?: Icon[];
    /**
     * Additional config. Currently unused by the OpenFin implementation.
     */
    customConfig?: NameValuePair[];
    /**
     * The set of intents associated with this AppDir entry.
     */
    intents?: AppDirIntent[];
}
/**
 * An image for an app in the app directory.
 */
export interface AppImage {
    /**
     * A URL that points to an image.
     */
    url: string;
    /**
     * Alt text to be displayed with the image.
     */
    tooltip?: string;
    /**
     * Additional text description.
     */
    description?: string;
}

/**
 * An icon for an app in the app directory.
 */
export interface Icon {
    /**
     * A URL that points to an icon.
     */
    icon: string;
}

/**
 * The application allows extra configuration to be passed in, and uses an array of NameValuePairs,
 * where the key is the name.
 */
export interface NameValuePair {
    /**
     * Key for the extra configuration.
     */
    name: string;
    /**
     * Value for the extra configuration.
     */
    value: string;
}
/**
 * This is a representation of an [FDC3 Intent](https://fdc3.finos.org/docs/1.0/intents-intro) supported by the app in the app directory.
 */
export interface AppDirIntent {
    /**
     * The intent name.
     */
    name: string;
    /**
     * The human-readable name to display.
     */
    displayName?: string;
    /**
     * The context types that this intent supports. A context type is a namespaced name;
     * examples are given [here](https://fdc3.finos.org/docs/1.0/context-spec).
     */
    contexts: string[];

    // Specification is ambiguous on type of customConfig, so leaving as 'any'
    /* tslint:disable:no-any */
    /**
     * Custom configuration for the intent. Currently unused, reserved for future use.
     */
    customConfig: any;
}
