import {injectable, inject} from 'inversify';
import {WindowEvent, ApplicationEvent} from 'openfin/_v2/api/events/base';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';
import {withTimeout} from 'openfin-service-async';

import {AsyncInit} from '../controller/AsyncInit';
import {FDC3Error, ApplicationError} from '../../client/types/errors';
import {APIFromClientTopic, SERVICE_IDENTITY} from '../../client/internal';
import {Application} from '../../client/main';
import {sanitizeIdentity} from '../../client/validation';
import {Timeouts} from '../constants';
import {Injector} from '../common/Injector';
import {getId} from '../utils/getId';
import {Inject} from '../common/Injectables';
import {APIHandler} from '../APIHandler';

import {Environment, EntityType} from './Environment';
import {AppConnection} from './AppConnection';
import {AppDirectory} from './AppDirectory';
import {ContextChannel} from './ContextChannel';
import {FinAppConnection} from './FinAppConnection';
import {FinAppWindow} from './FinAppWindow';
import {LiveApp} from './LiveApp';

interface KnownEntity {
    entityNumber: number;
    entityType: EntityType;
}

@injectable()
export class FinEnvironment extends AsyncInit implements Environment {
    public readonly onApplicationCreated: Signal<[Identity, LiveApp]> = new Signal();
    public readonly onApplicationClosed: Signal<[Identity]> = new Signal();

    public readonly onWindowCreated: Signal<[Identity]> = new Signal();
    public readonly onWindowClosed: Signal<[Identity]> = new Signal();

    /**
     * Stores details of all known windows and IAB connections.
     *
     * Will include all OpenFin windows currently open, plus all active external connections to the service.
     */
    private readonly _knownEntities: Map<string, KnownEntity> = new Map<string, KnownEntity>();
    private readonly _applications: Set<string> = new Set<string>();

    private _entityCount: number = 0;

    constructor(@inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>) {
        super();

        apiHandler.onDisconnection.add(this.onApiHandlerDisconnection, this);
    }

    public createApplication(appInfo: Application): void {
        const uuid = AppDirectory.getUuidFromApp(appInfo);

        const startPromise = withTimeout(
            Timeouts.APP_START_FROM_MANIFEST,
            fin.Application.startFromManifest(appInfo.manifest).catch((e) => {
                this.deregisterApplication({uuid});

                throw new FDC3Error(ApplicationError.LaunchError, (e as Error).message);
            })
        ).then((result) => {
            const [didTimeout] = result;

            if (didTimeout) {
                this.deregisterApplication({uuid});
                throw new FDC3Error(ApplicationError.LaunchTimeout, `Timeout waiting for application '${appInfo.name}' to start from manifest`);
            }
        });

        this.registerApplication({uuid}, startPromise);
    }

    public wrapConnection(liveApp: LiveApp, identity: Identity, entityType: EntityType, channel: ContextChannel): AppConnection {
        identity = sanitizeIdentity(identity);
        const id = getId(identity);

        // If `identity` is an adapter connection that hasn't yet connected to the service, there will not be a KnownEntity for this identity
        // In these cases, we will register the entity now
        const knownEntity: KnownEntity | undefined = this._knownEntities.get(id) || this.registerEntity(identity, entityType);

        if (knownEntity) {
            const {entityNumber} = knownEntity;

            if (entityType === EntityType.EXTERNAL_CONNECTION) {
                return new FinAppConnection(identity, entityType, liveApp, channel, entityNumber);
            } else {
                if (entityType !== EntityType.WINDOW) {
                    console.warn(`Unexpected entity type: ${entityType}. Treating as a regular OpenFin window.`);
                }

                return new FinAppWindow(identity, entityType, liveApp, channel, entityNumber);
            }
        } else {
            throw new Error('Cannot wrap entities belonging to the provider');
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
            interface OFManifest {
                shortcut?: {name?: string; icon: string};
                // eslint-disable-next-line camelcase
                startup_app: {uuid: string; name?: string; icon?: string};
            }

            const application = fin.Application.wrapSync(identity);
            const applicationInfo = await application.getInfo();

            const {shortcut, startup_app: startupApp} = applicationInfo.manifest as OFManifest;

            const title = (shortcut && shortcut.name) || startupApp.name || startupApp.uuid;
            const icon = (shortcut && shortcut.icon) || startupApp.icon;

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
            this.registerEntity(identity, EntityType.WINDOW);
        });

        fin.System.addListener('window-closed', async (event: WindowEvent<'system', 'window-closed'>) => {
            const identity = {uuid: event.uuid, name: event.name};

            await Injector.initialized;
            this.deregisterEntity(identity);
            this.deregisterApplication({uuid: event.uuid});
        });

        // No await here otherwise the injector will never properly initialize - The injector awaits this init before completion!
        Injector.initialized.then(async () => {
            // Register windows that were running before launching the FDC3 service
            windowInfo.forEach((info) => {
                const {uuid, mainWindow, childWindows} = info;
                this.registerApplication({uuid: info.uuid}, undefined);

                this.registerEntity({uuid, name: mainWindow.name}, EntityType.WINDOW);
                childWindows.forEach((child) => this.registerEntity({uuid, name: child.name}, EntityType.WINDOW));
            });
        });
    }

    private onApiHandlerDisconnection(identity: Identity): void {
        const id: string = getId(identity);
        const connection: KnownEntity|undefined = this._knownEntities.get(id);

        // Only retain knowledge of the entity if it's a window.
        // Windows are removed when they are closed, all other entity types are removed when they disconnect.
        if (connection && connection.entityType !== EntityType.WINDOW) {
            this.deregisterEntity(identity);
        }
    }

    private registerEntity(identity: Identity, entityType: EntityType): KnownEntity|undefined {
        if (identity.uuid !== SERVICE_IDENTITY.uuid) {
            const entity: KnownEntity = {
                entityNumber: this._entityCount,
                entityType
            };

            this._knownEntities.set(getId(identity), entity);
            this._entityCount++;

            if (entityType === EntityType.WINDOW) {
                this.onWindowCreated.emit(identity);
            }

            return entity;
        } else {
            return undefined;
        }
    }

    private deregisterEntity(identity: Identity): void {
        if (identity.uuid !== SERVICE_IDENTITY.uuid) {
            const id = getId(identity);
            const entity = this._knownEntities.get(id);

            if (entity) {
                this._knownEntities.delete(id);

                if (entity.entityType === EntityType.WINDOW) {
                    this.onWindowClosed.emit(identity);
                }
            }
        }
    }

    private registerApplication(identity: Identity, startedPromise: Promise<void> | undefined): void {
        const {uuid} = identity;

        if (uuid !== SERVICE_IDENTITY.uuid) {
            if (!this._applications.has(uuid)) {
                this._applications.add(uuid);
                this.onApplicationCreated.emit(identity, new LiveApp(startedPromise));
            }
        }
    }

    private deregisterApplication(identity: Identity): void {
        const {uuid} = identity;

        if (uuid !== SERVICE_IDENTITY.uuid) {
            if (this._applications.delete(uuid)) {
                this.onApplicationClosed.emit(identity);
            }
        }
    }
}
