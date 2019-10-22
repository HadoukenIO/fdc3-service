import {injectable, inject} from 'inversify';

import {Inject} from '../common/Injectables';
import {Intent} from '../../client/intents';
import {IntentResolution, Application} from '../../client/main';
import {FDC3Error, ResolveError, ResolveErrorMessage} from '../../client/errors';
import {Model} from '../model/Model';
import {AppDirectory} from '../model/AppDirectory';
import {AppWindow} from '../model/AppWindow';
import {APIToClientTopic, ReceiveIntentPayload} from '../../client/internal';
import {APIHandler} from '../APIHandler';
import {raceTilPredicate, withTimeout} from '../utils/async';
import {Timeouts} from '../constants';
import {Environment} from '../model/Environment';

import {ResolverResult, ResolverHandlerBinding} from './ResolverHandler';

@injectable()
export class IntentHandler {
    private readonly _directory: AppDirectory;
    private readonly _environment: Environment;
    private readonly _model: Model;
    private readonly _resolver: ResolverHandlerBinding;
    private readonly _apiHandler: APIHandler<APIToClientTopic>;

    private _resolvePromise: Promise<IntentResolution> | null;

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.ENVIRONMENT) environment: Environment,
        @inject(Inject.MODEL) model: Model,
        @inject(Inject.RESOLVER) resolver: ResolverHandlerBinding,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIToClientTopic>
    ) {
        this._directory = directory;
        this._environment = environment;
        this._model = model;
        this._resolver = resolver;
        this._apiHandler = apiHandler;

        this._resolvePromise = null;
    }

    public async raise(intent: Intent): Promise<IntentResolution> {
        if (hasTarget(intent)) {
            return this.raiseWithTarget(intent);
        } else {
            return this.startResolve(intent);
        }
    }

    private async raiseWithTarget(intent: IntentWithTarget): Promise<IntentResolution> {
        const apps = await this._model.getApplicationsForIntent(intent.type, intent.context.type);
        const targetApp = apps.find(app => app.name === intent.target);

        if (targetApp !== undefined) {
            // Target intent handles intent with given context, so fire
            return this.fireIntent(intent, targetApp);
        } else {
            // Target intent does not handles intent with given, so determine why and throw an error
            const targetInDirectory = await this._directory.getAppByName(intent.target);
            const targetRunning = await this._environment.isRunning(targetInDirectory ? AppDirectory.getUuidFromApp(targetInDirectory) : intent.target);

            if (!targetInDirectory && !targetRunning) {
                throw new FDC3Error(
                    ResolveError.TargetAppNotAvailable,
                    `Couldn't resolve intent target '${intent.target}'. No matching app in directory or currently running.`
                );
            } else {
                throw new FDC3Error(
                    ResolveError.TargetAppDoesNotHandleIntent,
                    `App '${intent.target}' does not handle intent '${intent.type}' with context '${intent.context.type}'`
                );
            }
        }
    }

    private async startResolve(intent: Intent): Promise<IntentResolution> {
        const apps: Application[] = await this._model.getApplicationsForIntent(intent.type, intent.context.type);

        if (apps.length === 0) {
            throw new FDC3Error(ResolveError.NoAppsFound, 'No applications available to handle this intent');
        } else if (apps.length === 1) {
            console.log(`App '${apps[0].name}' found to resolve intent '${intent.type}, firing intent'`);

            // Resolve intent immediately
            return this.fireIntent(intent, apps[0]);
        } else {
            console.log(`${apps.length} apps found to resolve intent '${intent.type}', showing resolver'`);

            return this.queueResolve(intent, apps);
        }
    }

    private async queueResolve(intent: Intent, applications: Application[]): Promise<IntentResolution> {
        if (this._resolvePromise) {
            console.log(`Resolver showing, re-resolving intent '${intent.type}' when resolver closes'`);

            this._resolvePromise = this._resolvePromise.catch(() => {}).then(() => this.startResolve(intent));

            return this._resolvePromise;
        } else {
            // Show resolver
            const selection: ResolverResult | null = await this._resolver.handleIntent(intent, applications).catch(e => {
                console.warn(e);
                return null;
            });

            if (!selection) {
                throw new FDC3Error(ResolveError.ResolverClosedOrCancelled, 'Resolver closed or cancelled');
            }

            // Handle response
            console.log(`App ${selection.app.name} selected to resolve intent '${intent.type}', firing intent`);
            return this.fireIntent(intent, selection.app);
        }
    }

    private async fireIntent(intent: Intent, appInfo: Application): Promise<IntentResolution> {
        await this._model.ensureRunning(appInfo);
        const appWindows = await this._model.expectWindowsForApp(appInfo);
        const promises = appWindows.map(async (window: AppWindow): Promise<any> => {
            if (await window.isReadyToReceiveIntent(intent.type)) {
                const payload: ReceiveIntentPayload = {context: intent.context, intent: intent.type};
                return this._apiHandler.dispatch(window.identity, APIToClientTopic.RECEIVE_INTENT, payload);
            } else {
                throw new Error(`${appInfo.name} not ready to recieve intents.`);
            }
        });

        let data: unknown;
        try {
            // Use the first handler return data that matches the predicate
            const [didTimeout, result] = await withTimeout(Timeouts.INTENT_RESOLUTION, raceTilPredicate(promises, returnValuePredicate));
            if (didTimeout) {
                throw new Error('Race timed out');
            }
            data = result;
        } catch (error) {
            if (/Exceptions in all/.test(error.message)) {
                throw new FDC3Error(ResolveError.IntentHandlerException, `${ResolveErrorMessage[ResolveError.IntentHandlerException]} ${appInfo.name}`);
            }
            if (/Race/.test(error.message)) {
                throw new FDC3Error(ResolveError.IntentTimeout, `Timeout waiting for intent listener to be added for intent: ${intent.type}`);
            }
            throw error;
        }

        const resolution: IntentResolution = {
            source: appInfo.name,
            version: '1.0.0',
            data
        };

        // Handle next queued intent
        console.log(`Finished intent: ${intent.type}`, resolution);

        return resolution;
    }
}

interface IntentWithTarget extends Intent {
    // Overwrite optional `target` from Intent, making it mandatory
    target: string;
}

// Guard to help narrow down Intent into IntentWithTarget
function hasTarget(intent: Intent): intent is IntentWithTarget {
    return !!intent.target;
}

// Check if the intent handler return value is valid defined.
function returnValuePredicate(value?: any) {
    return value === false || value === '' || !!value;
}
