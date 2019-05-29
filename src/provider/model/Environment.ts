import {Identity} from 'openfin/_v2/main';

import {Signal1, Signal2} from '../common/Signal';
import {Application} from '../../client/main';

import {AppWindow} from './AppWindow';

export interface Environment {
    windowCreated: Signal2<Identity, string>;
    windowClosed: Signal1<Identity>;

    /**
     * Creates a new application, given an App Directory entry.
     * @throws:
     * * FDC3Error if app fails to start
     * * FDC3Error if timeout trying to start app
     */
    createApplication: (appInfo: Application) => Promise<AppWindow>;

    /**
     * Creates an `AppWindow` object for an existing window.
     */
    wrapApplication: (appInfo: Application, identity: Identity) => AppWindow;
}
