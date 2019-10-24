import {WindowEvent} from 'openfin/_v2/api/events/base';
import {injectable, inject} from 'inversify';
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
import {Inject} from '../common/Injectables';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';

import {Environment, EntityType} from './Environment';
import {AppConnection} from './AppConnection';
import {ContextChannel} from './ContextChannel';
import {FinAppConnection} from './FinAppConnection';
import {FinAppWindow} from './FinAppWindow';

interface KnownEntity {
    creationTime: number | undefined;
    index: number;
    entityType: EntityType;
}

type KnownEntityMap = Map<string, KnownEntity>;

@injectable()
export class FinEnvironment extends AsyncInit implements Environment {
    public readonly onWindowCreated: Signal<[Identity]> = new Signal();
    public readonly onWindowClosed: Signal<[Identity]> = new Signal();

    /**
     * Stores details of all known windows and IAB connections.
     *
     * Will include all OpenFin windows currently open, plus all active external connections to the service.
     */
    private readonly _knownEntities: KnownEntityMap = new Map<string, KnownEntity>();
    private _entityCount: number = 0;

    constructor(@inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>) {
        super();

        apiHandler.onDisconnection.add(this.onApiHandlerDisconnection, this);
    }

    public async isRunning(uuid: string): Promise<boolean> {
        return fin.Application.wrapSync({uuid}).isRunning();
    }

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

    public wrapApplication(appInfo: Application, identity: Identity, entityType: EntityType, channel: ContextChannel): AppConnection {
        identity = parseIdentity(identity);
        const id = getId(identity);

        // If `identity` is an adapter connection that hasn't yet connected to the service, there will not be a KnownEntity for this identity
        // We will instead take the time at which the identity was wrapped as this connection's creation time
        const knownEntity: KnownEntity = this._knownEntities.get(id) || this.registerConnection(identity, Date.now(), entityType);
        const {creationTime, index} = knownEntity;

        if (entityType === EntityType.EXTERNAL_CONNECTION || entityType === EntityType.IFRAME) {
            return new FinAppConnection(identity, entityType, appInfo, channel, creationTime, index);
        } else {
            if (entityType !== EntityType.WINDOW) {
                console.warn(`Unexpected entity type: ${entityType}. Treating as a regular OpenFin window.`);
            }

            return new FinAppWindow(identity, appInfo, channel, creationTime, index);
        }
    }

    public async inferApplication(identity: Identity): Promise<Application> {
        if (await this.getEntityType(identity) === EntityType.EXTERNAL_CONNECTION) {
            return {
                appId: identity.uuid,
                name: identity.uuid,
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
        const extendedIdentity = identity as (Identity & {entityType: string | undefined});

        // Attempt to avoid async call if possible
        if (extendedIdentity.entityType) {
            return extendedIdentity.entityType as EntityType;
        } else if (this._knownEntities.has(getId(identity))) {
            return this._knownEntities.get(getId(identity))!.entityType;
        } else {
            const entityInfo = await fin.System.getEntityInfo(identity.uuid, identity.uuid);
            return entityInfo.entityType as EntityType;
        }
    }

    public isKnownEntity(identity: Identity): boolean {
        return this._knownEntities.has(getId(identity));
    }

    protected async init(): Promise<void> {
        // Register windows that were running before launching the FDC3 service
        const windowInfo = await fin.System.getAllWindows();

        fin.System.addListener('window-created', async (event: WindowEvent<'system', 'window-created'>) => {
            await Injector.initialized;
            const identity = {uuid: event.uuid, name: event.name};
            this.registerConnection(identity, Date.now(), EntityType.WINDOW);
        });
        fin.System.addListener('window-closed', async (event: WindowEvent<'system', 'window-closed'>) => {
            await Injector.initialized;
            const identity = {uuid: event.uuid, name: event.name};

            this._knownEntities.delete(getId(identity));

            this.onWindowClosed.emit(identity);
        });

        // No await here otherwise the injector will never properly initialize - The injector awaits this init before completion!
        Injector.initialized.then(async () => {
            windowInfo.forEach(info => {
                const {uuid, mainWindow, childWindows} = info;

                this.registerConnection({uuid, name: mainWindow.name}, undefined, EntityType.WINDOW);
                childWindows.forEach(child => this.registerConnection({uuid, name: child.name}, undefined, EntityType.WINDOW));
            });
        });
    }

    private onApiHandlerDisconnection(identity: Identity): void {
        const id: string = getId(identity);
        const connection: KnownEntity|undefined = this._knownEntities.get(id);

        // Only retain knowledge of the entity if it's a window.
        // Windows are removed when they are closed, all other entity types are removed when they disconnect.
        if (connection && connection.entityType !== EntityType.WINDOW) {
            this._knownEntities.delete(id);
        }
    }

    private registerConnection(identity: Identity, creationTime: number | undefined, entityType: EntityType): KnownEntity {
        const entity: KnownEntity = {
            creationTime,
            index: this._entityCount,
            entityType
        };

        this._knownEntities.set(getId(identity), entity);
        this._entityCount++;

        if (entityType === EntityType.WINDOW) {
            this.onWindowCreated.emit(identity);
        }

        return entity;
    }
}
