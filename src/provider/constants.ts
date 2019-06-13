/**
 * Timeouts, in milliseconds, for the different FDC3 actions
 */
export const Timeouts = {
    /**
     * Time for an app to register a listener after opening
     */
    ADD_INTENT_LISTENER: 5000,
    /**
     * Time for an OpenFin app to start by calling `fin.Application.startFromManifest`
     */
    APP_START_FROM_MANIFEST: 30000
};
