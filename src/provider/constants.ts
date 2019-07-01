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

export const DESKTOP_CHANNELS = [
    {
        id: 'red',
        name: 'Red',
        color: 0xFF0000
    },
    {
        id: 'orange',
        name: 'Orange',
        color: 0xFF8000
    },
    {
        id: 'yellow',
        name: 'Yellow',
        color: 0xFFFF00
    },
    {
        id: 'green',
        name: 'Green',
        color: 0x00FF00
    },
    {
        id: 'blue',
        name: 'Blue',
        color: 0x0000FF
    },
    {
        id: 'purple',
        name: 'Purple',
        color: 0xFF00FF
    }
];
