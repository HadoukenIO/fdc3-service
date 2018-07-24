import {IApplication} from '../client/directory';
import * as fdc3 from '../client/index';
import {Payload} from '../client/index';

import {AppDirectory} from './AppDirectory';
import {IAppMetadata, MetadataStore} from './MetadataStore';
import {PreferencesStore} from './PreferencesStore';

console.log('the provider has landed.');

// Create and initialise desktop agent
let service: FDC3 = null;
fin.desktop.main(async () => {
    service = new FDC3();
    await service.register();
});

/**
 * When the user is shown an app selector popup, they have the option of telling the service how to handle similar
 * intents in the future.
 *
 * This enum defines the options available to users.
 */
export const enum eDefaultAction {
    /**
     * Service should always show the app selection UI, to allow the user to choose which application to use.
     */
    ALWAYS_ASK = 'ALWAYS_ASK',

    /**
     * The service should always use the current selection when the intent is coming from the app that fired the
     * current intent.
     */
    ALWAYS_FOR_APP = 'ALWAYS_FOR_APP',

    /**
     * The service should always use the current selection, whenever an intent of this type is fired.
     */
    ALWAYS_FOR_INTENT = 'ALWAYS_FOR_INTENT'
}

// Message definitions
export interface IOpenArgs {
    name: string;
    context?: any;  // tslint:disable-line
}
export interface IResolveArgs {
    intent: fdc3.IntentType;
    context?: any;  // tslint:disable-line
}
export interface ISelectorResultArgs {
    handle: number;
    success: boolean;

    /**
     * The application that was selected by the user.
     *
     * Only specified when success is true.
     */
    app?: IApplication;

    /**
     * The reason that an app wasn't selected.
     *
     * Only specified when success is false.
     */
    reason?: string;

    /**
     * Determines the future behaviour of this intent
     */
    defaultAction: eDefaultAction;
}

/**
 * If there are multiple applications available that can handle an intent, the service must ask the user which
 * application they would like to use. To avoid confusing users, only one selector will be shown at a time - if
 * another intent is fired whilst the resolver is open then it will be queued.
 *
 * This interface is used to wrap each intent that comes into the service that requires manual resolution by the
 * user. These wrappers can then be placed in a queue.
 *
 * NOTE: Only intents that require user interaction will (potentially) be placed in a queue. Any explicit intents,
 * or intents where there is only one application available, will always be handled immediately.
 */
interface IQueuedIntent {
    /**
     * A unique identifier for this intent.
     *
     * This is created when the service first recives the intent, and is used to manage communication across between
     * the service back-end and front-end.
     */
    handle: number;

    /**
     * The original intent, launched by the user
     */
    intent: fdc3.Intent;

    /**
     * UUID of the application that fired this intent
     */
    source: IAppMetadata;

    /**
     * List of available applications that are capable of handling the intent
     */
    applications: IApplication[];

    /**
     * The application spawned by the service to allow the user to decide how to handle the intent.
     *
     * If there are multiple simultanous intents that require a user selection, they will be queued. Only the first
     * item in the queue will have an application - selector will be null until the intent reaches the front of the
     * queue.
     */
    selector: fin.OpenFinApplication|null;

    /**
     * Function to use to resolve this intent
     */
    resolve: (selectedApp: IApplication) => void;

    /**
     * Function to use to reject this intent
     */
    reject: (reason: Error) => void;
}

/**
 * FDC3 service implementation
 *
 * This class provides the back-end to the FDC3 API that is made available to applications.
 */
class FDC3 {
    public static MSG_RESOLVE: string = 'FDC3.Resolve';
    public static MSG_OPEN: string = 'FDC3.Open';
    public static MSG_BROADCAST: string = 'FDC3.Broadcast';
    public static MSG_INTENT: string = 'FDC3.Intent';
    public static MSG_SELECTOR_RESULT: string = 'FDC3.SelectorResult';

    private directory: AppDirectory;
    private metadata: MetadataStore;
    private preferences: PreferencesStore;

    private uiQueue: IQueuedIntent[];

    constructor() {
        this.directory = new AppDirectory();
        this.metadata = new MetadataStore();
        this.preferences = new PreferencesStore();
        this.uiQueue = [];
    }

    public async register(): Promise<void> {
        console.log('registering the service.');

        const service = await fin.desktop.Service.register();
        service.onConnection(console.log);

        console.log('registered the service.');

        service.register(FDC3.MSG_OPEN, this.onOpen.bind(this));
        service.register(FDC3.MSG_RESOLVE, this.onResolve.bind(this));
        service.register(FDC3.MSG_BROADCAST, this.onBroadcast.bind(this));
        service.register(FDC3.MSG_INTENT, this.onIntent.bind(this));
        service.register(FDC3.MSG_SELECTOR_RESULT, this.onSelectorResult.bind(this));
    }

    private async onOpen(payload: IOpenArgs): Promise<void> {
        const applications: IApplication[] = await this.directory.getApplications();
        const requestedApp: IApplication = applications.find((app: IApplication) => app.name === payload.name);

        return new Promise<void>((resolve: () => void, reject: (reason: Error) => void) => {
            if (requestedApp) {
                this.openApplication(requestedApp, payload.context).then(resolve, reject);
            } else {
                reject(new Error('No app with name \'' + payload.name + '\''));
            }
        });
    }

    private async onResolve(payload: IResolveArgs): Promise<IApplication[]> {
        const applications: IApplication[] = await this.directory.getApplications();

        if (payload.intent) {
            // Return all applications within the manifest that can handle the given intent
            return applications.filter((app: IApplication) => app.intents.includes(payload.intent));
        } else {
            // Return all applications. Used by the demo to populate the launcher, but may not be to-spec.
            return applications;
        }
    }

    private async onBroadcast(context: Payload): Promise<void> {
        return this.sendContext(context);
    }

    private async onIntent(intent: fdc3.Intent, source: fin.OpenFinIdentity): Promise<void> {
        let applications: IApplication[] = await this.onResolve({intent: intent.intent, context: intent.context});

        if (applications.length > 1) {
            applications = this.applyIntentPreferences(intent, applications, source);
        }

        if (applications.length === 1) {
            // Return all applications within the manifest that can handle the given intent
            return this.onOpen({name: applications[0].name}).then(() => {
                return this.sendIntent(intent, this.metadata.lookupFromDirectoryId(applications[0].id));
            });
        } else if (applications.length > 1) {
            // Ask user to manually select an application
            return this.resolveIntent(intent, source, applications).then((selectedApp: IApplication) => {
                return this.sendIntent(intent, this.metadata.lookupFromDirectoryId(selectedApp.id));
            });
        } else {
            throw new Error('No applications available to handle this intent');
        }
    }

    /**
     * Takes an intent that is in the process of being resolved, and attempts to find the best application for handling
     * that intent.
     *
     * If only one application is available, that application will be used. Otherwise, preferances both within the
     * intent itself and defined by the user, will be used to attempt to find the preferred application for handling
     * the intent.
     *
     * If it is not possible to identify the "best" application, function will return the input list of applications. In
     * this scenario, the user will then be asked to resolve the intent manually.
     *
     * @param intent The intent being resolved
     * @param applications List of applications capable of handling the current intent
     * @param source The application that fired the intent
     */
    private applyIntentPreferences(intent: fdc3.Intent, applications: IApplication[], source: fin.OpenFinIdentity): IApplication[] {
        // Check for any explicit target set within the intent
        if (intent.target) {
            const preferredApplication: IApplication = applications.find((app: IApplication) => app.name === intent.target);

            if (preferredApplication) {
                return [preferredApplication];
            }
        }

        // Check for any user preferences
        const preferredAppId: number = this.preferences.getPreferredApp(this.metadata.mapUUID(source.uuid), intent.intent);
        if (applications.length > 1 && preferredAppId) {
            const preferredApplication: IApplication = applications.find((app: IApplication) => app.id === preferredAppId);

            if (preferredApplication) {
                // We found an applicable user preference, ignore the other applications
                return [preferredApplication];
            }
        }

        // No applicable preferences. User will have to select an app manually.
        return applications;
    }

    private onSelectorResult(result: ISelectorResultArgs): void {
        const queuedIntent: IQueuedIntent = this.uiQueue[0];

        if (queuedIntent && queuedIntent.handle === result.handle) {
            // Hide selector UI
            queuedIntent.selector.close();

            if (result.success && result.app) {
                // Remember the user's selection
                switch (result.defaultAction) {
                    case eDefaultAction.ALWAYS_FOR_INTENT:
                        this.preferences.setGlobalPreference(queuedIntent.intent.intent, result.app.id);
                        break;
                    case eDefaultAction.ALWAYS_FOR_APP:
                        if (queuedIntent.source) {
                            this.preferences.setAppPreference(queuedIntent.source.directoryId, queuedIntent.intent.intent, result.app.id);
                        }
                        break;
                    default:
                }

                // Open the selected application
                this.openApplication(result.app).then(() => {
                    queuedIntent.resolve(result.app);
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
     * Will start the application if not already running, or focus the application if it is currently open.
     *
     * Promise will be resolved once application has been opened, and confirmation has been received that the context
     * was passed to the application.
     *
     * @param requestedApp The application to open
     * @param context Context data to pass to the application
     */
    private async openApplication(requestedApp: IApplication, context?: Payload): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const metadata: IAppMetadata = this.metadata.lookupFromDirectoryId(requestedApp.id);

            this.isAppRunning(metadata && metadata.uuid).then((isRunning: boolean) => {
                if (!isRunning) {
                    // Start application and pass context to it
                    this.startApplication(requestedApp, context).then(() => {
                        resolve();
                    }, reject);
                } else if (context) {
                    // Pass new context to existing application instance and focus
                    this.sendContext(context).then(resolve, reject);
                    this.focusApplication(metadata);
                } else {
                    // Bring application to foreground and then resolve
                    this.focusApplication(metadata);
                    resolve();
                }
            }, reject);
        });
    }

    private async startApplication(appInfo: IApplication, context?: Payload): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (reason: Error) => void) => {
            if (appInfo) {
                fin.desktop.Application.createFromManifest(
                    appInfo.manifest_url,
                    (app: fin.OpenFinApplication) => {
                        // Setup a timeout for the registration of an intent listener
                        const timeout = setTimeout(() => {
                            console.warn('Timeout whilst waiting for application to start');
                            reject(new Error('Timeout whilst waiting for application to start: ' + appInfo.name));
                        }, 5000);

                        // Populate mapping between app directory ID's and app uuid's from the manifest
                        this.metadata.update(appInfo, app);

                        // Start application
                        app.run(
                            (status: {httpResponseCode: number}) => {
                                clearTimeout(timeout);
                                if (context) {
                                    // Pass context to application before resolving
                                    fin.desktop.InterApplicationBus.publish('context', {context}, resolve, (reason: string) => reject(new Error(reason)));
                                } else {
                                    // Application started successfully - can now resolve
                                    resolve();
                                }
                            },
                            (reason: string, error: fin.NetworkErrorInfo) => {
                                clearTimeout(timeout);
                                reject(new Error(reason || 'App startup failure'));
                            });
                    },
                    (reason: string) => {
                        reject(new Error(reason));
                    });
            } else {
                reject(new Error('No app details given'));
            }
        });
    }

    private focusApplication(app: IAppMetadata): void {
        fin.desktop.Window.wrap(app.uuid, app.name).focus();
    }

    /**
     * Opens a UI dialog to allow the user to manually resolve an intent.
     *
     * The promise is resolved once the user has made a selection, with the app that they select.
     *
     * To avoid confusion, only one selector can be opened at a time. If this function is called when a selector is
     * already open, the intent will be queued and handled once the previous selection is complete.
     *
     * @param intent Intent that needs to be resolved
     * @param source Set of identifiers for the OpenFin app that fired the intent
     * @param applications A pre-filtered list of applications that are capable of handling the intent
     */
    private async resolveIntent(intent: fdc3.Intent, source: fin.OpenFinIdentity, applications: IApplication[]): Promise<IApplication> {
        const removeFromQueue = (intent: IQueuedIntent): void => {
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

        return new Promise<IApplication>((resolve, reject) => {
            // Add to queue
            const queuedIntent: IQueuedIntent = {
                handle: this.createHandle(),
                intent,
                source: this.metadata.lookupFromAppUUID(source.uuid),
                applications,
                selector: null,
                resolve: (selectedApp: IApplication) => {
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

    private async openAppSelector(queuedIntent: IQueuedIntent): Promise<fin.OpenFinApplication> {
        const baseUrl: string = window.location.href.split('/').slice(0, -1).join('/');
        const appUrl: string = baseUrl + '/ui/selector.html';
        return new Promise<fin.OpenFinApplication>((resolve, reject) => {
            const selector: fin.OpenFinApplication = new fin.desktop.Application(
                {
                    uuid: 'fdc3-selector',
                    name: 'fdc3-selector',
                    url: appUrl,
                    mainWindowOptions: {
                        customData: queuedIntent,
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
                reject);

            queuedIntent.selector = selector;
        });
    }

    private async sendContext(context: Payload): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (reason: Error) => void) => {
            fin.desktop.InterApplicationBus.publish('context', context, resolve, (reason: string) => reject(new Error(reason)));
        });
    }

    private async sendIntent(intent: fdc3.Intent, targetApp: IAppMetadata): Promise<void> {
        return new Promise<void>((resolve: () => void, reject: (reason: Error) => void) => {
            if (targetApp) {
                fin.desktop.InterApplicationBus.send(targetApp.uuid, 'intent', intent, resolve, (reason: string) => reject(new Error(reason)));
            } else {
                // Intents should be one-to-one, but as a fallback broadcast this intent to all applications
                console.warn('No target given for intent. Going to broadcast to all applications');
                fin.desktop.InterApplicationBus.publish('intent', intent, resolve, (reason: string) => reject(new Error(reason)));
            }
        });
    }

    private async isAppRunning(uuid: string): Promise<boolean> {
        return new Promise<boolean>((resolve: (value: boolean) => void, reject: (reason: string) => void) => {
            fin.desktop.System.getAllApplications((applicationInfoList: fin.ApplicationInfo[]) => {
                resolve(!!applicationInfoList.find((app: fin.ApplicationInfo) => app.uuid === uuid && app.isRunning));
            }, reject);
        });
    }

    private createHandle(): number {
        // Returns a large random integer
        return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    }
}