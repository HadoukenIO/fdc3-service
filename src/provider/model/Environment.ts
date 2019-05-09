import {injectable} from 'inversify';
import {WindowEvent} from 'openfin/_v2/api/events/base';
import {Identity} from 'openfin/_v2/main';

import {Signal1, Signal2} from '../common/Signal';
import {AsyncInit} from '../controller/AsyncInit';
import {Application} from '../../client/main';
import {FDC3Error, OpenError} from '../../client/errors';

import {AppWindow} from './AppWindow';

export interface Environment {
    windowCreated: Signal2<Identity, string>;
    windowClosed: Signal1<Identity>;

    /**
     * Creates a new application, given an App Directory entry.
     */
    createApplication: (appInfo: Application) => Promise<AppWindow>;

    /**
     * Creates an `AppWindow` object for an existing window.
     */
    wrapApplication: (appInfo: Application, identity: Identity) => AppWindow;
}

@injectable()
export class FinEnvironment extends AsyncInit implements Environment {
    /**
     * Indicates that a new window has been created.
     *
     * When the service first starts, this signal will also be fired for any pre-existing windows.
     *
     * Arguments: (identity: Identity, manifestUrl: string)
     */
    public readonly windowCreated: Signal2<Identity, string> = new Signal2();

    /**
     * Indicates that a window has been closed.
     *
     * Arguments: (identity: Identity)
     */
    public readonly windowClosed: Signal1<Identity> = new Signal1();

    public async createApplication(appInfo: Application): Promise<AppWindow> {
        try {
            const app = await fin.Application.startFromManifest(appInfo.manifest);
            return new AppWindow(app.identity, appInfo);
        } catch (e) {
            throw new FDC3Error(OpenError.ErrorOnLaunch, (e as Error).message);
        }
    }

    public wrapApplication(appInfo: Application, identity: Identity): AppWindow {
        return new AppWindow(identity, appInfo);
    }

    protected async init(): Promise<void> {
        fin.System.addListener('window-created', (event: WindowEvent<'system', 'window-created'>) => {
            const identity = {uuid: event.uuid, name: event.name};
            this.registerWindow(identity);
        });
        fin.System.addListener('window-closed', (event: WindowEvent<'system', 'window-closed'>) => {
            const identity = {uuid: event.uuid, name: event.name};
            this.windowClosed.emit(identity);
        });

        const windowInfo = await fin.System.getAllWindows();
        windowInfo.forEach(info => {
            const {uuid, mainWindow, childWindows} = info;

            this.registerWindow({uuid, name: mainWindow.name});
            childWindows.forEach(child => this.registerWindow({uuid, name: child.name}));
        });
    }

    private async registerWindow(identity: Identity): Promise<void> {
        const info = await fin.Application.wrapSync(identity).getInfo();
        this.windowCreated.emit(identity, info.manifestUrl);
    }
}
