import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';
import {Identity} from 'openfin/_v2/main';

import {ContextBase} from '../client/context';
import {Application} from '../client/directory';
import {APITopic, BroadcastPayload, FindIntentPayload, RaiseIntentPayload, TopicPayloadMap, TopicResponseMap, GetAllChannelsPayload, JoinChannelPayload, GetChannelPayload, GetChannelMembersPayload} from '../client/internal';
import {AppIntent, IntentResolution} from '../client/main';
import {Channel, ChannelChangedEvent} from '../client/contextChannels';

import {ActionHandlerMap, APIHandler} from './APIHandler';
import {AppDirectory} from './AppDirectory';
import {AppMetadata, MetadataStore} from './MetadataStore';
import {PreferencesStore} from './PreferencesStore';
import {createChannelModel, ChannelModel} from './ChannelModel';

import {DefaultAction, OpenArgs, QueuedIntent, ResolveArgs, SelectorResultArgs} from './index';

/**
 * FDC3 service implementation
 *
 * This class provides the back-end to the FDC3 API that is made available to
 * applications.
 */
export class FDC3 {
    public static MSG_SELECTOR_RESULT: string = 'FDC3.SelectorResult';
    private directory: AppDirectory;
    private metadata: MetadataStore;
    private preferences: PreferencesStore;
    private channelModel: ChannelModel;
    private uiQueue: QueuedIntent[];
    private apiHandler: APIHandler<APITopic, TopicPayloadMap, TopicResponseMap>;
    constructor() {
        this.directory = new AppDirectory();
        this.metadata = new MetadataStore();
        this.preferences = new PreferencesStore();
        this.apiHandler = new APIHandler();
        this.channelModel = createChannelModel(this.apiHandler.onConnection, this.apiHandler.onDisconnection);
        this.uiQueue = [];

        this.channelModel.onChannelChanged.add(this.onChannelChangedHandler, this);
    }

    public async register(): Promise<void> {
        // Define a custom handler mapping here. Ideally this will be replaced with the one in
        // APIMappings once the provider is more modularized.
        const actionHandlerMap: ActionHandlerMap<APITopic, TopicPayloadMap, TopicResponseMap> = {
            [APITopic.OPEN]: this.onOpen.bind(this),
            [APITopic.FIND_INTENT]: this.onResolve.bind(this),
            [APITopic.FIND_INTENTS_BY_CONTEXT]: () => new Promise<AppIntent[]>(() => {}),
            [APITopic.BROADCAST]: this.onBroadcast.bind(this),
            [APITopic.RAISE_INTENT]: this.onIntent.bind(this),
            [APITopic.GET_ALL_CHANNELS]: this.onGetAllChannels.bind(this),
            [APITopic.JOIN_CHANNEL]: this.onJoinChannel.bind(this),
            [APITopic.GET_CHANNEL]: this.onGetChannel.bind(this),
            [APITopic.GET_CHANNEL_MEMBERS]: this.onGetChannelMembers.bind(this)
        };

        console.log('registering the service.');
        await this.apiHandler.registerListeners(actionHandlerMap);
        console.log('registered the service.');
        // Special handler for responses from the resolver UI. Should come up with a better way of
        // managing these comms
        this.apiHandler.channel.register(FDC3.MSG_SELECTOR_RESULT, this.onSelectorResult.bind(this));
    }

    private async onOpen(payload: OpenArgs): Promise<void> {
        const applications: Application[] = await this.directory.getApplications();
        const requestedApp: Application | undefined = applications.find((app: Application) => app.name === payload.name);
        return new Promise<void>((resolve: () => void, reject: (reason: Error) => void) => {
            if (requestedApp) {
                this.openApplication(requestedApp, payload.context).then(resolve, reject);
            } else {
                reject(new Error('No app with name \'' + payload.name + '\''));
            }
        });
    }

    private async onResolve(payload: FindIntentPayload): Promise<AppIntent> {
        const applications: Application[] = await this.directory.getApplications();
        if (payload.intent) {
            // Return all applications within the manifest that can handle the given
            // intent
            const filteredApps = applications.filter((app: Application) => app.intents && app.intents.some(intent => intent.name === payload.intent));
            return {
                // TODO: update this to handle display names once provider is updated to include them (SERVICE-392?)
                intent: {name: payload.intent, displayName: payload.intent},
                apps: filteredApps
            };
        } else {
            // Return all applications. Used by the demo to populate the launcher, but
            // may not be to-spec.
            return {
                // TODO: update this to handle display names once provider is updated to include them (SERVICE-392?)
                intent: {name: payload.intent, displayName: payload.intent},
                apps: applications
            };
        }
    }

    private async onBroadcast(payload: BroadcastPayload, source: ProviderIdentity): Promise<void> {
        const channel = this.channelModel.getChannel(source);
        const channelMembers = this.channelModel.getChannelMembers(channel.id);

        const context = payload.context;

        this.channelModel.setContext(channel.id, context);

        return Promise.all(channelMembers.map(identity => this.sendContext(identity, context))).then(() => {});
    }

    private async onIntent(payload: RaiseIntentPayload, source: ProviderIdentity): Promise<IntentResolution> {
        let applications: Application[] = (await this.onResolve({intent: payload.intent, context: payload.context})).apps;
        if (applications.length > 1) {
            applications = this.applyIntentPreferences(payload, applications, source);
        }
        if (applications.length === 1) {
            // Return all applications within the manifest that can handle the given
            // intent
            return this.onOpen({name: applications[0].name}).then(() => {
                return this.sendIntent(payload, this.metadata.lookupFromDirectoryId(applications[0].appId)!);
            });
        } else if (applications.length > 1) {
            // Ask user to manually select an application
            return this.resolveIntent(payload, source, applications).then((selectedApp: Application) => {
                return this.sendIntent(payload, this.metadata.lookupFromDirectoryId(selectedApp.appId)!);
            });
        } else {
            throw new Error('No applications available to handle this intent');
        }
    }

    private async onGetAllChannels(payload: GetAllChannelsPayload, source: ProviderIdentity): Promise<Channel[]> {
        return this.channelModel.getAllChannels();
    }

    private async onJoinChannel(payload: JoinChannelPayload, source: ProviderIdentity): Promise<void> {
        const identity = payload.identity || source;

        this.channelModel.joinChannel(identity, payload.id);
        const context = this.channelModel.getContext(payload.id);

        if (context) {
            this.sendContext(identity, context);
        }
    }

    private async onGetChannel(payload: GetChannelPayload, source: ProviderIdentity): Promise<Channel> {
        const identity = payload.identity || source;

        return this.channelModel.getChannel(identity);
    }

    private async onGetChannelMembers(payload: GetChannelMembersPayload, source: ProviderIdentity): Promise<Identity[]> {
        return this.channelModel.getChannelMembers(payload.id);
    }

    /**
     * Takes an intent that is in the process of being resolved, and attempts to
     * find the best application for handling that intent.
     *
     * If only one application is available, that application will be used.
     * Otherwise, preferances both within the intent itself and defined by the
     * user, will be used to attempt to find the preferred application for
     * handling the intent.
     *
     * If it is not possible to identify the "best" application, function will
     * return the input list of applications. In this scenario, the user will then
     * be asked to resolve the intent manually.
     *
     * @param intent The intent being resolved
     * @param applications List of applications capable of handling the current
     * intent
     * @param source The application that fired the intent
     */
    private applyIntentPreferences(intent: RaiseIntentPayload, applications: Application[], source: Identity): Application[] {
        // Check for any explicit target set within the intent
        if (intent.target) {
            const preferredApplication: Application | undefined = applications.find((app: Application) => app.appId === intent.target);
            if (preferredApplication) {
                return [preferredApplication];
            }
        }
        // Check for any user preferences
        const preferredAppId: string = this.preferences.getPreferredApp(this.metadata.mapUUID(source.uuid)!, intent.intent)!;
        if (applications.length > 1 && preferredAppId) {
            const preferredApplication: Application | undefined = applications.find((app: Application) => app.appId === preferredAppId);
            if (preferredApplication) {
                // We found an applicable user preference, ignore the other applications
                return [preferredApplication];
            }
        }
        // No applicable preferences. User will have to select an app manually.
        return applications;
    }

    private onSelectorResult(result: SelectorResultArgs): void {
        const queuedIntent: QueuedIntent = this.uiQueue[0];
        if (queuedIntent && queuedIntent.handle === result.handle) {
            // Hide selector UI
            queuedIntent.selector!.close();
            if (result.success && result.app) {
                // Remember the user's selection
                switch (result.defaultAction) {
                    case DefaultAction.ALWAYS_FOR_INTENT:
                        this.preferences.setGlobalPreference(queuedIntent.intent.intent, result.app.appId);
                        break;
                    case DefaultAction.ALWAYS_FOR_APP:
                        if (queuedIntent.source) {
                            this.preferences.setAppPreference(queuedIntent.source.directoryId, queuedIntent.intent.intent, result.app.appId);
                        }
                        break;
                    default:
                }
                // Open the selected application
                this.openApplication(result.app).then(() => {
                    queuedIntent.resolve(result.app!);
                }, queuedIntent.reject);
            } else {
                // Return error to application
                queuedIntent.reject(new Error(result.reason));
            }
        }
    }

    /**
     * Opens the specified app with the given context.
     *
     * Will start the application if not already running, or focus the application
     * if it is currently open.
     *
     * Promise will be resolved once application has been opened, and confirmation
     * has been received that the context was passed to the application.
     *
     * @param requestedApp The application to open
     * @param context Context data to pass to the application
     */
    private async openApplication(requestedApp: Application, context?: ContextBase): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const metadata: AppMetadata | null = this.metadata.lookupFromDirectoryId(requestedApp.appId);
            const uuid = (metadata && metadata.uuid) || '';

            this.isAppRunning(uuid).then((isRunning: boolean) => {
                if (!isRunning) {
                    // Start application and pass context to it
                    this.startApplication(requestedApp, context).then(() => {
                        resolve();
                    }, reject);
                } else if (context) {
                    // Pass new context to existing application instance and focus
                    this.sendContext(metadata!, context).then(resolve, reject);
                    this.focusApplication(metadata!);
                } else {
                    // Bring application to foreground and then resolve
                    this.focusApplication(metadata!);
                    resolve();
                }
            }, reject);
        });
    }

    private async startApplication(appInfo: Application, context?: ContextBase): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (reason: Error) => void) => {
            if (!appInfo) {
                reject(new Error('No app details given'));
            }

            if (appInfo.manifestType === undefined) {
                reject(new Error('Directory entry must specify a manifestType for each app'));
            }

            if (appInfo.manifestType !== 'openfin') {
                reject(new Error(`Manifest type ${appInfo.manifestType} not supported`));
            }

            try {
                JSON.parse(appInfo.manifest);
                reject(new Error('Inline JSON manifests not supported'));
            } catch (e) {
                // JSON.parse should not be passed valid JSON.  If it is, then it will 'pass' and we reject.
                // If its not valid JSON, then we enter this catch and continue on.
            }

            fin.Application.createFromManifest(appInfo.manifest)
                .then((app) => {
                    // Setup a timeout for the registration of an intent listener
                    const timeout = setTimeout(() => {
                        console.warn('Timeout whilst waiting for application to start');
                        reject(new Error('Timeout whilst waiting for application to start: ' + appInfo.name));
                    }, 15000);
                    // Populate mapping between app directory ID's and app uuid's
                    // from the manifest
                    this.metadata.update(appInfo, app);
                    // Start application
                    app.run()
                        .then(() => {
                            clearTimeout(timeout);
                            if (context) {
                                // Pass context to application before resolving (assume that the main window is the one with listeners registered)
                                console.log('*** dispatching', Date.now());
                                this.apiHandler.channel.dispatch({...app.identity, name: app.identity.uuid}, 'context', context)
                                    .then(resolve).catch((reason: string) => reject(new Error(reason)));
                            } else {
                                // Application started successfully - can now resolve
                                resolve();
                            }
                        })
                        .catch((reason: string) => {
                            clearTimeout(timeout);
                            reject(new Error(reason || 'App startup failure'));
                        });
                })
                .catch((reason: string) => {
                    reject(new Error(reason));
                });
        });
    }

    private focusApplication(app: AppMetadata): void {
        fin.Window.wrapSync(app).focus();
    }

    /**
     * Opens a UI dialog to allow the user to manually resolve an intent.
     *
     * The promise is resolved once the user has made a selection, with the app
     * that they select.
     *
     * To avoid confusion, only one selector can be opened at a time. If this
     * function is called when a selector is already open, the intent will be
     * queued and handled once the previous selection is complete.
     *
     * @param intent Intent that needs to be resolved
     * @param source Set of identifiers for the OpenFin app that fired the intent
     * @param applications A pre-filtered list of applications that are capable of
     * handling the intent
     */
    private async resolveIntent(intent: RaiseIntentPayload, source: Identity, applications: Application[]): Promise<Application> {
        const removeFromQueue = (intent: QueuedIntent): void => {
            const index: number = this.uiQueue.indexOf(intent);
            if (index >= 0) {
                // Remove from queue
                this.uiQueue.splice(index, 1);
                // Trigger next item in queue
                if (index === 0 && this.uiQueue.length > 0) {
                    this.openAppSelector(this.uiQueue[0]);
                }
            }
        };
        return new Promise<Application>((resolve, reject) => {
            // Add to queue
            const queuedIntent: QueuedIntent = {
                handle: this.createHandle(),
                intent,
                source: this.metadata.lookupFromAppUUID(source.uuid)!,
                applications,
                selector: null,
                resolve: (selectedApp: Application) => {
                    removeFromQueue(queuedIntent);
                    resolve(selectedApp);
                },
                reject: (reason) => {
                    removeFromQueue(queuedIntent);
                    reject(reason);
                }
            };
            this.uiQueue.push(queuedIntent);
            // If not currently handling an intent, start processing immediately
            if (this.uiQueue.length === 1) {
                this.openAppSelector(this.uiQueue[0]);
            }
        });
    }

    private async openAppSelector(queuedIntent: QueuedIntent): Promise<fin.OpenFinApplication> {
        const baseUrl: string = window.location.href.split('/').slice(0, -1).join('/');
        const appUrl: string = baseUrl + '/ui/selector.html';
        return new Promise<fin.OpenFinApplication>((resolve, reject) => {
            const selector = new fin.desktop.Application(
                {
                    uuid: 'fdc3-selector',
                    name: 'fdc3-selector',
                    url: appUrl,
                    mainWindowOptions: {
                        customData: JSON.stringify(queuedIntent),
                        // alwaysOnTop: true,
                        autoShow: true,
                        saveWindowState: false,
                        defaultCentered: true,
                        frame: false,
                        resizable: false,
                        defaultWidth: 400,
                        defaultHeight: 670
                    }
                },
                (successObj: fin.SuccessObj) => {
                    selector.run((successObj: fin.SuccessObj) => {
                        // App selector is now open and visible
                        resolve(selector);
                    }, reject);
                },
                reject
            );
            queuedIntent.selector = selector;
        });
    }

    private async sendContext(identity: Identity, context: ContextBase): Promise<void> {
        console.log('*** dispatching', Date.now());
        await this.apiHandler.channel.dispatch(identity, 'context', context);
    }

    private async sendIntent(intent: RaiseIntentPayload, targetApp: AppMetadata): Promise<IntentResolution> {
        if (targetApp) {
            console.log('*** dispatching', Date.now());
            await this.apiHandler.channel.dispatch(targetApp, 'intent', intent);
            return {
                version: '1.0.0',
                source: targetApp.directoryId,
                data: null
            };
        } else {
            throw new Error('Internal error: No target given for intent. Ensure target application exists within directory.');
        }
    }

    private async isAppRunning(uuid: string): Promise<boolean> {
        return new Promise<boolean>((resolve: (value: boolean) => void, reject: (reason: string) => void) => {
            fin.System.getAllApplications().then((applicationInfoList: fin.ApplicationInfo[]) => {
                resolve(!!applicationInfoList.find((app: fin.ApplicationInfo) => app.uuid === uuid && app.isRunning));
            });
        });
    }

    private createHandle(): number {
        // Returns a large random integer
        return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }

    private onChannelChangedHandler(event: ChannelChangedEvent): void {
        console.log('*** publishing event', Date.now());

        // setImmediate(() => {
        this.apiHandler.channel.publish('event', event);
        // });
    }
}
