import {_Window} from 'openfin/_v2/api/window/window';
import {WindowOption} from 'openfin/_v2/api/window/windowOption';
import {injectable, inject} from 'inversify';
import {ChannelClient} from 'openfin/_v2/api/interappbus/channel/client';

import {Inject} from '../common/Injectables';
import {AppDirectory} from '../model/AppDirectory';
import {Model} from '../model/Model';
import {Intent, Application} from '../../client/main';
import {SERVICE_IDENTITY} from '../../client/internal';

import {AsyncInit} from './AsyncInit';

const SELECTOR_URL = (() => {
    let providerLocation = window.location.href;

    if (providerLocation.indexOf('http://localhost') === 0) {
        // Work-around for fake provider used within test runner
        providerLocation = providerLocation.replace('/test', '/provider');
    }

    // Locate the default selector HTML page, relative to the location of the provider
    return providerLocation.replace('provider.html', 'ui/selector.html');
})();

/**
 * When the user is shown an app selector popup, they have the option of telling
 * the service how to handle similar intents in the future.
 *
 * This enum defines the options available to users.
 */
export const enum DefaultAction {
    /**
     * Service should always show the app selection UI, to allow the user to
     * choose which application to use.
     */
    ALWAYS_ASK = 'ALWAYS_ASK',

    /**
     * The service should always use the current selection when the intent is
     * coming from the app that fired the current intent.
     */
    ALWAYS_FOR_APP = 'ALWAYS_FOR_APP',

    /**
     * The service should always use the current selection, whenever an intent of
     * this type is fired.
     */
    ALWAYS_FOR_INTENT = 'ALWAYS_FOR_INTENT'
}

/**
 * Data passed to app selector when it is invoked by the provider
 */
export interface SelectorArgs {
    intent: Intent;
    applications: Application[];
}

/**
 * Data returned by app selector when the user has made a selection
 */
export interface SelectorResult {
    app: Application;
    action: string;
}

@injectable()
export class SelectorHandler extends AsyncInit {
    private static SELECTOR_NAME: string = 'fdc3-selector';

    @inject(Inject.APP_DIRECTORY)
    private _directory!: AppDirectory;

    @inject(Inject.MODEL)
    private _model!: Model;

    private _window!: _Window;
    private _channel!: ChannelClient;

    /**
     * Performs one-off initialisation
     */
    protected async init(): Promise<void> {
        const options: WindowOption = {
            url: SELECTOR_URL,
            name: SelectorHandler.SELECTOR_NAME,
            // alwaysOnTop: true,
            autoShow: false,
            saveWindowState: false,
            defaultCentered: true,
            frame: false,
            resizable: false,
            defaultWidth: 400,
            defaultHeight: 670
        };

        // Close any existing selector window (in case service is restarted)
        await fin.Window.wrapSync({uuid: SERVICE_IDENTITY.uuid, name: SelectorHandler.SELECTOR_NAME}).close(true).catch(() => {});

        // Create selector
        this._window = await fin.Window.create(options);
        this._window.addListener('close-requested', () => false);
        this._channel = await fin.InterApplicationBus.Channel.connect('selector');
    }

    /**
     * Instructs the selector to prepare for a new intent.
     *
     * Selector should refresh it's UI, and then show itself when ready.
     *
     * @param intent Intent that is about to be resolved
     */
    public async handleIntent(intent: Intent): Promise<SelectorResult> {
        const msg: SelectorArgs = {
            intent,
            applications: await this._model.getApplicationsForIntent(intent.type)
        };

        await this._window.show();
        await this._window.setAsForeground();
        const selection: SelectorResult = await this._channel.dispatch('resolve', msg).catch(console.error);
        await this._window.hide();

        return selection;
    }

    /**
     * Instructs the selector to hide itself.
     *
     * The selector will be re-used if another intent needs to be resolved later. If there are queued intents, this
     * could be immediately after the selector is done cleaning-up.
     */
    public async cancel(): Promise<void> {
        this._window.hide();
    }
}
