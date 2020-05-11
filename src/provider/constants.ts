/**
 * Timeouts, in milliseconds, for the different FDC3 actions.
 */
export const Timeouts = {
    /**
     * Time before we consider an app 'mature', i.e., has had chance to register any listeners.
     */
    APP_MATURITY: 5000,

    /**
     * Time for an OpenFin app to start by calling `fin.Application.startFromManifest`.
     */
    APP_START_FROM_MANIFEST: 30000,

    /**
     * For windows, the time service allows for a `window-created` (or `view-created`) event after a client expects the
     * window to exist.
     *
     * For other entity types, the entity must connect to the service within this time of an expected connection.
     */
    ENTITY_INITIALIZE: 250,

    /**
     * Time service allows for a window to go from first created to being fully registered with the model.
     *
     * Applies only to windows, since there is no `window-created` equivilant for non-OpenFin windows/connections.
     */
    WINDOW_CREATED_TO_REGISTERED: 5000,

    /**
     * Time service allows for an API call to a client to resolve.
     */
    SERVICE_TO_CLIENT_API_CALL: 5000
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
