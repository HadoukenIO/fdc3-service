import {WindowEvent, ApplicationEvent} from 'openfin/_v2/api/events/base';
import {injectable} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';

import {AsyncInit} from '../controller/AsyncInit';
import {Application} from '../../client/main';
import {FDC3Error, OpenError} from '../../client/errors';
import {withTimeout} from '../utils/async';
import {Timeouts} from '../constants';
import {parseIdentity} from '../../client/validation';
import {Injector} from '../common/Injector';
import {getId} from '../utils/getId';
import {DeferredPromise} from '../common/DeferredPromise';

import {Environment, EntityType, ApplicationResult} from './Environment';
import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {FinAppWindow} from './FinAppWindow';
import {AppDirectory} from './AppDirectory';

interface EnvironmentWindow {
    index: number;
}

interface EnvironmentApplication {
    state: 'starting' | 'fresh' | 'mature';
    maturityDeferredPromise: DeferredPromise<void>;
    startApplicationPromise: Promise<void>;
}

type EnvironmentWindowMap = Map<string, EnvironmentWindow>;
type EnvironmentApplicationMap = Map<string, EnvironmentApplication>;

@injectable()
export class FinEnvironment extends AsyncInit implements Environment {
    /**
     * Indicates that a window has been created by the service.
     *
     * Arguments: (identity: Identity)
     */
    public readonly windowCreated: Signal<[Identity]> = new Signal();

    /**
     * Indicates that a window has been closed.
     *
     * Arguments: (identity: Identity)
     */
    public readonly windowClosed: Signal<[Identity]> = new Signal();

    private _windowsCreated: number = 0;

    private readonly _applications: EnvironmentApplicationMap = new Map<string, EnvironmentApplication>();
    private readonly _windows: EnvironmentWindowMap = new Map<string, EnvironmentWindow>();

    public async isRunning(appInfo: Application): Promise<boolean> {
        return this._applications.hasOwnProperty(AppDirectory.getUuidFromApp(appInfo));
    }

    public createApplication(appInfo: Application): ApplicationResult {
        const uuid = AppDirectory.getUuidFromApp(appInfo);

        const application = this._applications.get(uuid) || this.startApplication(appInfo);

        return {
            started: application.startApplicationPromise,
            mature: application.maturityDeferredPromise.promise
        };
    }

    public wrapWindow(appInfo: Application, identity: Identity, channel: ContextChannel): AppWindow {
        identity = parseIdentity(identity);
        const id = getId(identity);

        // If `identity` is an adapter connection, there will not be any `_applications` or `_windows` entry for this
        // identity. We will instead take the time at which the identity was wrapped as this application's creation time
        const environmentWindow = this._windows.get(id) || {index: this._windowsCreated++};
        const environmentApplication = this._applications.get(identity.uuid) || {
            state: 'starting',
            startApplicationPromise: Promise.resolve(),
            maturityDeferredPromise: new DeferredPromise()
        };

        if (environmentApplication.state === 'starting') {
            setTimeout(environmentApplication.maturityDeferredPromise.resolve, Timeouts.ADD_CONTEXT_LISTENER);
        }

        return new FinAppWindow(identity, appInfo, channel, environmentApplication.maturityDeferredPromise.promise, environmentWindow.index);
    }

    public async inferApplication(identity: Identity): Promise<Application> {
        if (this.isExternalWindow(identity)) {
            const application = fin.ExternalApplication.wrapSync(identity.uuid);

            return {
                appId: application.identity.uuid,
                name: application.identity.uuid,
                manifestType: 'openfin',
                manifest: ''
            };
        } else {
            type OFManifest = {
                shortcut?: {name?: string, icon: string},
                startup_app: {uuid: string, name?: string, icon?: string}
            };

            const application = fin.Application.wrapSync(identity);
            const applicationInfo = await application.getInfo();

            const {shortcut, startup_app} = applicationInfo.manifest as OFManifest;

            const title = (shortcut && shortcut.name) || startup_app.name || startup_app.uuid;
            const icon = (shortcut && shortcut.icon) || startup_app.icon;

            return {
                appId: application.identity.uuid,
                name: application.identity.uuid,
                title: title,
                icons: icon ? [{icon}] : undefined,
                manifestType: 'openfin',
                manifest: applicationInfo.manifestUrl
            };
        }
    }

    public async getEntityType(identity: Identity): Promise<EntityType> {
        const entityInfo = await fin.System.getEntityInfo(identity.uuid, identity.name!);

        return entityInfo.entityType as EntityType;
    }

    public isWindowCreated(identity: Identity): boolean {
        return this._windows.has(getId(identity));
    }

    protected async init(): Promise<void> {
        const windowInfo = await fin.System.getAllWindows();

        windowInfo.forEach(info => {
            if (!this._applications.has(info.uuid)) {
                const deferredPromise = new DeferredPromise<void>();
                deferredPromise.resolve();

                this._applications.set(info.uuid, {
                    state: 'mature',
                    maturityDeferredPromise: deferredPromise,
                    startApplicationPromise: Promise.resolve()
                });
            }
        });

        fin.System.addListener('application-started', (event: ApplicationEvent<'system', 'application-started'>) => {
            this.setApplicationFresh(event.uuid);
        });

        const appicationClosedHandler = (event: {uuid: string}) => {
            this.removeApplication(event.uuid);
        };

        fin.System.addListener('application-closed', appicationClosedHandler);
        fin.System.addListener('application-crashed', appicationClosedHandler);

        fin.System.addListener('window-created', async (event: WindowEvent<'system', 'window-created'>) => {
            const identity = {uuid: event.uuid, name: event.name};

            this.setApplicationFresh(event.uuid);

            await Injector.initialized;
            this.registerWindow(identity);
        });

        fin.System.addListener('window-closed', async (event: WindowEvent<'system', 'window-closed'>) => {
            const identity = {uuid: event.uuid, name: event.name};

            await Injector.initialized;
            this.deregisterWindow(identity);
        });

        // No await here otherwise the injector will never properly initialize - The injector awaits this init before completion!
        Injector.initialized.then(async () => {
            // Register windows that were running before launching the FDC3 service
            windowInfo.forEach(info => {
                const {uuid, mainWindow, childWindows} = info;

                this.registerWindow({uuid, name: mainWindow.name});
                childWindows.forEach(child => this.registerWindow({uuid, name: child.name}));
            });
        });
    }

    private registerWindow(identity: Identity): void {
        const createdWindow = {index: this._windowsCreated};

        this._windows.set(getId(identity), createdWindow);
        this._windowsCreated++;

        this.windowCreated.emit(identity);
    }

    private deregisterWindow(identity: Identity): void {
        this._windows.delete(getId(identity));
        this.windowClosed.emit(identity);
    }

    private async isExternalWindow(identity: Identity): Promise<boolean> {
        const extendedIdentity = identity as (Identity & {entityType: string | undefined});

        const externalWindowType = 'external connection';

        if (extendedIdentity.entityType) {
            return extendedIdentity.entityType === externalWindowType;
        } else {
            const entityInfo = await fin.System.getEntityInfo(identity.uuid, identity.uuid);

            return entityInfo.entityType === externalWindowType;
        }
    }

    private startApplication(appInfo: Application): EnvironmentApplication {
        const uuid = AppDirectory.getUuidFromApp(appInfo);

        const startPromise = withTimeout(
            Timeouts.APP_START_FROM_MANIFEST,
            fin.Application.startFromManifest(appInfo.manifest).catch(e => {
                this.removeApplication(uuid);

                throw new FDC3Error(OpenError.ErrorOnLaunch, (e as Error).message);
            })
        ).then((result) => {
            const didTimeout = [result];

            if (didTimeout) {
                this.removeApplication(uuid);

                throw new FDC3Error(OpenError.AppTimeout, `Timeout waiting for app '${appInfo.name}' to start from manifest`);
            }
        });

        const application: EnvironmentApplication = {
            state: 'starting',
            maturityDeferredPromise: new DeferredPromise(),
            startApplicationPromise: startPromise
        };

        this._applications.set(uuid, application);

        return application;
    }

    private setApplicationFresh(uuid: string): void {
        const application = this._applications.get(uuid) || {
            state: 'starting',
            maturityDeferredPromise: new DeferredPromise(),
            startApplicationPromise: Promise.resolve()
        };
        this._applications.set(uuid, application);

        if (application.state === 'starting') {
            setTimeout(application.maturityDeferredPromise.resolve, Timeouts.ADD_CONTEXT_LISTENER);
        }
    }

    private removeApplication(uuid: string): void {
        const failedApplication = this._applications.get(uuid);

        if (failedApplication) {
            failedApplication.maturityDeferredPromise.reject();
            this._applications.delete(uuid);
        }
    }
}
