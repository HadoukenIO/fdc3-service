/* eslint-disable @typescript-eslint/camelcase, camelcase */

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
import {SERVICE_IDENTITY} from '../../client/internal';

import {Environment, EntityType} from './Environment';
import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {FinAppWindow} from './FinAppWindow';
import {AppDirectory} from './AppDirectory';
import {LiveApp} from './LiveApp';

interface EnvironmentWindow {
    index: number;
}

type EnvironmentWindowMap = Map<string, EnvironmentWindow>;
type EnvironmentApplicationSet = Set<string>;

@injectable()
export class FinEnvironment extends AsyncInit implements Environment {
    public readonly applicationCreated: Signal<[Identity, LiveApp]> = new Signal();
    public readonly applicationClosed: Signal<[Identity]> = new Signal();

    public readonly windowCreated: Signal<[Identity]> = new Signal();
    public readonly windowClosed: Signal<[Identity]> = new Signal();

    private readonly _applications: EnvironmentApplicationSet = new Set<string>();
    private readonly _windows: EnvironmentWindowMap = new Map<string, EnvironmentWindow>();

    private _windowsCreated: number = 0;

    public createApplication(appInfo: Application): void {
        const uuid = AppDirectory.getUuidFromApp(appInfo);

        const startPromise = withTimeout(
            Timeouts.APP_START_FROM_MANIFEST,
            fin.Application.startFromManifest(appInfo.manifest).catch((e) => {
                this.deregisterApplication({uuid});

                throw new FDC3Error(OpenError.ErrorOnLaunch, (e as Error).message);
            })
        ).then((result) => {
            const [didTimeout] = result;

            if (didTimeout) {
                this.deregisterApplication({uuid});
                throw new FDC3Error(OpenError.AppTimeout, `Timeout waiting for app '${appInfo.name}' to start from manifest`);
            }
        });

        this.registerApplication({uuid}, startPromise);
    }

    public wrapWindow(liveApp: LiveApp, identity: Identity, channel: ContextChannel): AppWindow {
        identity = parseIdentity(identity);
        const id = getId(identity);

        // If `identity` is an adapter connection, there will not be any `_windows` entry for this identity
        const window = this._windows.get(id) || {index: this._windowsCreated++};

        return new FinAppWindow(identity, liveApp, channel, window.index);
    }

    public async inferApplication(identity: Identity): Promise<Application> {
        if (await this.isExternalWindow(identity)) {
            const application = fin.ExternalApplication.wrapSync(identity.uuid);

            return {
                appId: application.identity.uuid,
                name: application.identity.uuid,
                manifestType: 'openfin',
                manifest: ''
            };
        } else {
            interface OFManifest {
                shortcut?: {name?: string; icon: string};
                startup_app: {uuid: string; name?: string; icon?: string};
            }

            const application = fin.Application.wrapSync(identity);
            const applicationInfo = await application.getInfo();

            const {shortcut, startup_app} = applicationInfo.manifest as OFManifest;

            const title = (shortcut && shortcut.name) || startup_app.name || startup_app.uuid;
            const icon = (shortcut && shortcut.icon) || startup_app.icon;

            return {
                appId: application.identity.uuid,
                name: application.identity.uuid,
                title,
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

        fin.System.addListener('application-started', async (event: ApplicationEvent<'system', 'application-started'>) => {
            await Injector.initialized;
            this.registerApplication({uuid: event.uuid}, Promise.resolve());
        });

        const appicationClosedHandler = async (event: {uuid: string}) => {
            await Injector.initialized;
            this.deregisterApplication({uuid: event.uuid});
        };

        fin.System.addListener('application-closed', appicationClosedHandler);
        fin.System.addListener('application-crashed', appicationClosedHandler);

        fin.System.addListener('window-created', async (event: WindowEvent<'system', 'window-created'>) => {
            const identity = {uuid: event.uuid, name: event.name};

            await Injector.initialized;
            this.registerApplication({uuid: event.uuid}, Promise.resolve());
            this.registerWindow(identity);
        });

        fin.System.addListener('window-closed', async (event: WindowEvent<'system', 'window-closed'>) => {
            const identity = {uuid: event.uuid, name: event.name};

            await Injector.initialized;
            this.deregisterWindow(identity);
            this.deregisterApplication({uuid: event.uuid});
        });

        // No await here otherwise the injector will never properly initialize - The injector awaits this init before completion!
        Injector.initialized.then(async () => {
            // Register windows that were running before launching the FDC3 service
            windowInfo.forEach((info) => {
                const {uuid, mainWindow, childWindows} = info;
                this.registerApplication({uuid: info.uuid}, undefined);

                this.registerWindow({uuid, name: mainWindow.name});
                childWindows.forEach((child) => this.registerWindow({uuid, name: child.name}));
            });
        });
    }

    private registerWindow(identity: Identity): void {
        if (identity.uuid !== SERVICE_IDENTITY.uuid) {
            const createdWindow = {index: this._windowsCreated};

            this._windows.set(getId(identity), createdWindow);
            this._windowsCreated++;

            this.windowCreated.emit(identity);
        }
    }

    private deregisterWindow(identity: Identity): void {
        if (identity.uuid !== SERVICE_IDENTITY.uuid) {
            this._windows.delete(getId(identity));
            this.windowClosed.emit(identity);
        }
    }

    private registerApplication(identity: Identity, startedPromise: Promise<void> | undefined): void {
        const {uuid} = identity;

        if (uuid !== SERVICE_IDENTITY.uuid) {
            if (!this._applications.has(uuid)) {
                this._applications.add(uuid);
                this.applicationCreated.emit(identity, new LiveApp(startedPromise));
            }
        }
    }

    private deregisterApplication(identity: Identity): void {
        const {uuid} = identity;

        if (uuid !== SERVICE_IDENTITY.uuid) {
            if (this._applications.delete(uuid)) {
                this.applicationClosed.emit(identity);
            }
        }
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
}
