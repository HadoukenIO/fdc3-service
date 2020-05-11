import {injectable, inject} from 'inversify';
import {ApplicationOption} from 'openfin/_v2/api/application/applicationOption';
import {WindowEvent, ApplicationEvent} from 'openfin/_v2/api/events/base';
import {Identity} from 'openfin/_v2/main';
import {Signal} from 'openfin-service-signal';
import {withTimeout} from 'openfin-service-async';

import {AsyncInit} from '../controller/AsyncInit';
import {FDC3Error, ApplicationError} from '../../client/errors';
import {APIFromClientTopic, getServiceIdentity} from '../../client/internal';
import {Application} from '../../client/main';
import {parseIdentity} from '../../client/validation';
import {Timeouts} from '../constants';
import {Injector} from '../common/Injector';
import {getId} from '../utils/getId';
import {SemVer} from '../utils/SemVer';
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

    public readonly onWindowCreated: Signal<[Identity, EntityType]> = new Signal();
    public readonly onWindowClosed: Signal<[Identity, EntityType]> = new Signal();

    private readonly _apiHandler: APIHandler<APIFromClientTopic>;

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

        this._apiHandler = apiHandler;
        this._apiHandler.onDisconnection.add(this.onApiHandlerDisconnection, this);
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
        identity = parseIdentity(identity);
        const id = getId(identity);
        const version: SemVer = this._apiHandler.getClientVersion(id);

        // If `identity` is an adapter connection that hasn't yet connected to the service, there will not be a KnownEntity for this identity
        // In these cases, we will register the entity now
        const knownEntity: KnownEntity | undefined = this._knownEntities.get(id) || this.registerEntity(identity, entityType);

        if (knownEntity) {
            const {entityNumber} = knownEntity;

            if (entityType === EntityType.EXTERNAL_CONNECTION) {
                return new FinAppConnection(identity, entityType, version, liveApp, channel, entityNumber);
            } else {
                if (!isPagedEntity(entityType)) {
                    console.warn(`Connection '${id}' has unexpected entity type '${entityType}'. Some functionality may be unavailable.`);
                }

                return new FinAppWindow(identity, entityType, version, liveApp, channel, entityNumber);
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
                startup_app?: {uuid: string; name?: string; icon?: string};
            }

            const application = fin.Application.wrapSync(identity);
            const applicationInfo = await application.getInfo();
            let {name: title, icon} = applicationInfo.initialOptions as ApplicationOption;

            // `manifest` is defined as required property but actually optional. Not present on programmatically-launched apps.
            if (applicationInfo.manifest) {
                const {shortcut, startup_app: startupApp} = applicationInfo.manifest as OFManifest;
                title = (shortcut && shortcut.name) || (startupApp && (startupApp.name || startupApp.uuid));
                icon = (shortcut && shortcut.icon) || (startupApp && startupApp.icon);
            }

            return {
                appId: identity.uuid,
                name: identity.uuid,
                title,
                icons: icon ? [{icon}] : undefined,
                manifestType: 'openfin',
                // `manifestUrl` is defined as required property but actually optional. Not present on programmatically-launched apps.
                manifest: applicationInfo.manifestUrl || ''
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

        const appicationClosedHandler = async (event: {uuid: string}) => {
            await Injector.initialized;
            this.deregisterApplication({uuid: event.uuid});
        };
        const entityCreatedHandler = async <T>(entityType: EntityType, event: WindowEvent<'system', T>) => {
            const identity = {uuid: event.uuid, name: event.name};

            await Injector.initialized;
            this.registerApplication({uuid: event.uuid}, Promise.resolve());
            this.registerEntity(identity, entityType);
        };
        const entityClosedHandler = async <T>(event: WindowEvent<'system', T>) => {
            const identity = {uuid: event.uuid, name: event.name};

            await Injector.initialized;
            this.deregisterEntity(identity);
        };

        fin.System.addListener('application-started', async (event: ApplicationEvent<'system', 'application-started'>) => {
            await Injector.initialized;
            this.registerApplication({uuid: event.uuid}, Promise.resolve());
        });
        fin.System.addListener('application-closed', appicationClosedHandler);
        fin.System.addListener('application-crashed', appicationClosedHandler);

        fin.System.addListener('window-created', entityCreatedHandler.bind(this, EntityType.WINDOW));
        fin.System.addListener('window-closed', entityClosedHandler);

        fin.System.addListener('view-created', entityCreatedHandler.bind(this, EntityType.VIEW));
        fin.System.addListener('view-destroyed', entityClosedHandler);

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
        if (connection && !isPagedEntity(connection.entityType)) {
            this.deregisterEntity(identity);
        }
    }

    private registerEntity(identity: Identity, entityType: EntityType): KnownEntity|undefined {
        if (identity.uuid !== getServiceIdentity().uuid) {
            const entity: KnownEntity = {
                entityNumber: this._entityCount,
                entityType
            };

            this._knownEntities.set(getId(identity), entity);
            this._entityCount++;

            if (isPagedEntity(entityType)) {
                this.onWindowCreated.emit(identity, entityType);
            }

            return entity;
        } else {
            return undefined;
        }
    }

    private deregisterEntity(identity: Identity): void {
        if (identity.uuid !== getServiceIdentity().uuid) {
            const id = getId(identity);
            const entity = this._knownEntities.get(id);

            if (entity) {
                this._knownEntities.delete(id);

                if (isPagedEntity(entity.entityType)) {
                    this.onWindowClosed.emit(identity, entity.entityType);
                }
            }
        }
    }

    private registerApplication(identity: Identity, startedPromise: Promise<void> | undefined): void {
        const {uuid} = identity;

        if (uuid !== getServiceIdentity().uuid) {
            if (!this._applications.has(uuid)) {
                this._applications.add(uuid);
                this.onApplicationCreated.emit(identity, new LiveApp(startedPromise));
            }
        }
    }

    private deregisterApplication(identity: Identity): void {
        const {uuid} = identity;

        if (uuid !== getServiceIdentity().uuid) {
            if (this._applications.delete(uuid)) {
                this.onApplicationClosed.emit(identity);
            }
        }
    }
}

/**
 * Checks if an entity is of a "page-based" entity type. These are entities that are built using a
 * webpage/browser/DOM/etc. This only includes entity types that both meet this definition, AND are supported by
 * the service.
 *
 * These entity types have a more finely controlled handshake process, as the fin API provides better eventing
 * and querying of these entity types.
 */
function isPagedEntity(entityType: EntityType): boolean {
    return entityType === EntityType.WINDOW || entityType === EntityType.VIEW;
}
