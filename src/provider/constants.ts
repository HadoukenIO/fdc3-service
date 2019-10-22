/**
 * Timeouts, in milliseconds, for the different FDC3 actions
 */
export const Timeouts = {
    /**
     * Time for an app to register an intent listener after opening
     */
    ADD_INTENT_LISTENER: 5000,

    /**
     * Time for an app to register a context listener after opening
     */
    ADD_CONTEXT_LISTENER: 5000,

    /**
     * Time for an OpenFin app to start by calling `fin.Application.startFromManifest`
     */
    APP_START_FROM_MANIFEST: 30000,

    /**
     * Time service allows for an application's intent handler to resolve and return a value for the data field on an {@link IntentResolution}.
     */
    INTENT_RESOLUTION: 5000,

    /**
     * Time service allows for a `window-created` event after a client expects the window to exist
     */
    WINDOW_EXPECT_TO_CREATED: 250,

    /**
     * Time service allows for a window to go from first created to being fully registered with the model
     */
    WINDOW_CREATED_TO_REGISTERED: 5000
};

export const CustomConfigFields = {
    OPENFIN_APP_UUID: 'appUuid'
};

export const SYSTEM_CHANNELS = [
    {
        id: 'red',
        visualIdentity: {
            name: 'Red',
            color: '#FF0000',
            glyph: 'https://openfin.co/favicon.ico'
        }
    },
    {
        id: 'orange',
        visualIdentity: {
            name: 'Orange',
            color: '#FF8000',
            glyph: 'https://openfin.co/favicon.ico'
        }
    },
    {
        id: 'yellow',
        visualIdentity: {
            name: 'Yellow',
            color: '#FFFF00',
            glyph: 'https://openfin.co/favicon.ico'
        }
    },
    {
        id: 'green',
        visualIdentity: {
            name: 'Green',
            color: '#00FF00',
            glyph: 'https://openfin.co/favicon.ico'
        }
    },
    {
        id: 'blue',
        visualIdentity: {
            name: 'Blue',
            color: '#0000FF',
            glyph: 'https://openfin.co/favicon.ico'
        }
    },
    {
        id: 'purple',
        visualIdentity: {
            name: 'Purple',
            color: '#FF00FF',
            glyph: 'https://openfin.co/favicon.ico'
        }
    }
];
