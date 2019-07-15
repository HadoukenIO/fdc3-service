import {Identity} from 'openfin/_v2/main';

import {Signal1, Signal2} from '../common/Signal';
import {Application} from '../../client/main';

import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';

export interface Environment {
    windowCreated: Signal2<Identity, string>;
    windowClosed: Signal1<Identity>;

    /**
     * Creates a new application, given an App Directory entry.
     * @throws:
     * * FDC3Error if app fails to start
     * * FDC3Error if timeout trying to start app
     */
    createApplication: (appInfo: Application, channel: ContextChannel) => Promise<void>;

    /**
     * Creates an `AppWindow` object for an existing window. Should only be called once per window.
     */
    wrapApplication: (appInfo: Application, identity: Identity, channel: ContextChannel) => AppWindow;

    /**
     * Examines a running window, and returns a best-effort Application description
     */
    inferApplication: (identity: Identity) => Promise<Application>;
}
