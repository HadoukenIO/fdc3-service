import {WindowEvent} from 'openfin/_v2/api/events/base';
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

import {Environment, EntityType} from './Environment';
import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {FinAppWindow} from './FinAppWindow';
import {AppDirectory} from './AppDirectory';

interface CreatedWindow {
    creationTime: number | undefined;
    index: number;
}

type CreatedWindowMap = Map<string, CreatedWindow>;

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
    private readonly _createdWindows: CreatedWindowMap = new Map<string, CreatedWindow>();

    public async isRunning(appInfo: Application): Promise<boolean> {
        const uuid = AppDirectory.getUuidFromApp(appInfo);
        const finApp = fin.Application.wrapSync({uuid});

        return finApp.isRunning();
    }

    public async createApplication(appInfo: Application, channel: ContextChannel): Promise<void> {
        const [didTimeout] = await withTimeout(
            Timeouts.APP_START_FROM_MANIFEST,
            fin.Application.startFromManifest(appInfo.manifest).catch((e) => {
                throw new FDC3Error(OpenError.ErrorOnLaunch, (e as Error).message);
            })
        );
        if (didTimeout) {
            throw new FDC3Error(OpenError.AppTimeout, `Timeout waiting for app '${appInfo.name}' to start from manifest`);
        }
    }

    public wrapApplication(appInfo: Application, identity: Identity, channel: ContextChannel): AppWindow {
        identity = parseIdentity(identity);
        const id = getId(identity);

        // If `identity` is an adapter connection, there will not be any createdWindow entry for this identity
        // We will instead take the time at which the identity was wrapped as this "window's" creation time
        const createdWindow = this._createdWindows.get(id) || {creationTime: Date.now(), index: this._windowsCreated++};
        const {creationTime, index} = createdWindow;

        return new FinAppWindow(identity, appInfo, channel, creationTime, index);
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
        return this._createdWindows.has(getId(identity));
    }

    protected async init(): Promise<void> {
        // Register windows that were running before launching the FDC3 service
        const windowInfo = await fin.System.getAllWindows();

        fin.System.addListener('window-created', async (event: WindowEvent<'system', 'window-created'>) => {
            await Injector.initialized;
            const identity = {uuid: event.uuid, name: event.name};
            this.registerWindow(identity, Date.now());
        });
        fin.System.addListener('window-closed', async (event: WindowEvent<'system', 'window-closed'>) => {
            await Injector.initialized;
            const identity = {uuid: event.uuid, name: event.name};

            this._createdWindows.delete(getId(identity));

            this.windowClosed.emit(identity);
        });

        // No await here otherwise the injector will never properly initialize - The injector awaits this init before completion!
        Injector.initialized.then(async () => {
            windowInfo.forEach((info) => {
                const {uuid, mainWindow, childWindows} = info;

                this.registerWindow({uuid, name: mainWindow.name}, undefined);
                childWindows.forEach((child) => this.registerWindow({uuid, name: child.name}, undefined));
            });
        });
    }

    private async registerWindow(identity: Identity, creationTime: number | undefined): Promise<void> {
        const createdWindow = {
            creationTime,
            index: this._windowsCreated
        };

        this._createdWindows.set(getId(identity), createdWindow);
        this._windowsCreated++;

        this.windowCreated.emit(identity);
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
