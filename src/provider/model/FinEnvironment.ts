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

import {Environment, EntityType} from './Environment';
import {AppWindow} from './AppWindow';
import {ContextChannel} from './ContextChannel';
import {getId} from './Model';
import {FinAppWindow} from './FinAppWindow';

interface SeenWindow {
    creationTime: number | undefined;
    index: number;
}

@injectable()
export class FinEnvironment extends AsyncInit implements Environment {
    /**
     * Indicates that a window has been seen by the service.
     *
     * Unlike the `windowCreated` signal, this will be fired synchronously from the listener for the runtime window-created event,
     * but does not provide all information provided by the `windowCreated` signal. For a given window, this will always be fired
     * before the `windowCreated` signal.
     *
     * Arguments: (identity: Identity)
     */
    public readonly windowSeen: Signal<[Identity]> = new Signal();

    /**
     * Indicates that a new window has been created.
     *
     * When the service first starts, this signal will also be fired for any pre-existing windows.
     *
     * Arguments: (identity: Identity, manifestUrl: string)
     */
    public readonly windowCreated: Signal<[Identity, string]> = new Signal();

    /**
     * Indicates that a window has been closed.
     *
     * Arguments: (identity: Identity)
     */
    public readonly windowClosed: Signal<[Identity]> = new Signal();

    private _windowsCreated: number = 0;
    private readonly _seenWindows: {[id: string]: SeenWindow} = {};

    public async createApplication(appInfo: Application, channel: ContextChannel): Promise<void> {
        const [didTimeout] = await withTimeout(
            Timeouts.APP_START_FROM_MANIFEST,
            fin.Application.startFromManifest(appInfo.manifest).catch(e => {
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

        // If `identity` is an adapter connection, there will not be any seenWindow entry for this identity
        // We will instead take the time at which the identity was wrapped as this "window's" creation time
        const seenWindow = this._seenWindows[id] || {creationTime: Date.now(), index: this._windowsCreated++};
        const {creationTime, index} = seenWindow;

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

    public isWindowSeen(identity: Identity): boolean {
        return !!this._seenWindows[getId(identity)];
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

            delete this._seenWindows[getId(identity)];

            this.windowClosed.emit(identity);
        });

        // No await here otherwise the injector will never properly initialize - The injector awaits this init before completion!
        Injector.initialized.then(async () => {
            windowInfo.forEach(info => {
                const {uuid, mainWindow, childWindows} = info;

                this.registerWindow({uuid, name: mainWindow.name}, undefined);
                childWindows.forEach(child => this.registerWindow({uuid, name: child.name}, undefined));
            });
        });
    }

    private async registerWindow(identity: Identity, creationTime: number | undefined): Promise<void> {
        const seenWindow = {
            creationTime,
            index: this._windowsCreated
        };

        this._seenWindows[getId(identity)] = seenWindow;
        this._windowsCreated++;

        this.windowSeen.emit(identity);

        const info = await fin.Application.wrapSync(identity).getInfo();
        this.windowCreated.emit(identity, info.manifestUrl);
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
