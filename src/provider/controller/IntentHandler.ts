import {injectable, inject} from 'inversify';

import {Inject} from '../common/Injectables';
import {Intent} from '../intents';
import {IntentResolution, Application} from '../../client/main';
import {FDC3Error, ResolveError, ApplicationError, SendContextError} from '../../client/errors';
import {Model} from '../model/Model';
import {APIToClientTopic, ReceiveIntentPayload} from '../../client/internal';
import {APIHandler} from '../APIHandler';
import {collateClientCalls, ClientCallsResult} from '../utils/helpers';

import {ResolverResult, ResolverHandlerBinding} from './ResolverHandler';

@injectable()
export class IntentHandler {
    private readonly _model: Model;
    private readonly _resolver: ResolverHandlerBinding;
    private readonly _apiHandler: APIHandler<APIToClientTopic>;

    private _resolvePromise: Promise<IntentResolution> | null;

    constructor(
        @inject(Inject.MODEL) model: Model,
        @inject(Inject.RESOLVER) resolver: ResolverHandlerBinding,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIToClientTopic>
    ) {
        this._model = model;
        this._resolver = resolver;
        this._apiHandler = apiHandler;

        this._resolvePromise = null;
    }

    public async raise(intent: Intent): Promise<IntentResolution> {
        if (hasTarget(intent)) {
            return this.raiseWithTarget(intent);
        } else {
            return this.startResolve(intent, this.queueResolve.bind(this));
        }
    }

    private async raiseWithTarget(intent: IntentWithTarget): Promise<IntentResolution> {
        const apps = await this._model.getApplicationsForIntent(intent.type, intent.context.type);
        const targetApp = apps.find((app) => app.name === intent.target);

        if (targetApp !== undefined) {
            // Target intent handles intent with given context, so fire
            return this.fireIntent(intent, targetApp);
        } else if (await this._model.existsAppForName(intent.target)) {
            // Target exists but does not handle intent with given context
            throw new FDC3Error(
                ResolveError.AppDoesNotHandleIntent,
                `Application '${intent.target}' does not handle intent '${intent.type}' with context '${intent.context.type}'`
            );
        } else {
            // Target does not exist
            throw new FDC3Error(
                ApplicationError.NotFound,
                `No application '${intent.target}' found running or in directory`
            );
        }
    }

    private async startResolve(
        intent: Intent,
        handleAppChoice: (intent: Intent, apps: Application[]) => Promise<IntentResolution>
    ): Promise<IntentResolution> {
        const apps: Application[] = await this._model.getApplicationsForIntent(intent.type, intent.context.type);

        if (apps.length === 0) {
            throw new FDC3Error(ResolveError.NoAppsFound, `No applications available to handle intent '${intent.type}' with context '${intent.context.type}'`);
        } else if (apps.length === 1) {
            console.log(`App '${apps[0].name}' found to resolve intent '${intent.type}, firing intent'`);

            // Resolve intent immediately
            return this.fireIntent(intent, apps[0]);
        } else {
            console.log(`${apps.length} apps found to resolve intent '${intent.type}', delegating app choice'`);

            return handleAppChoice(intent, apps);
        }
    }

    private async queueResolve(intent: Intent, applications: Application[]): Promise<IntentResolution> {
        if (this._resolvePromise) {
            console.log(`Resolver showing, re-resolving intent '${intent.type}' when resolver closes'`);

            this._resolvePromise = this._resolvePromise.catch(() => {}).then(() => this.startResolve(intent, this.showResolver.bind(this)));
        } else {
            this._resolvePromise = this.showResolver(intent, applications);
        }

        const resolvePromise = this._resolvePromise.then((result) => {
            if (this._resolvePromise === resolvePromise) {
                this._resolvePromise = null;
            }
            return result;
        }, (error) => {
            if (this._resolvePromise === resolvePromise) {
                this._resolvePromise = null;
            }
            throw error;
        });
        this._resolvePromise = resolvePromise;

        return resolvePromise;
    }

    private async showResolver(intent: Intent, applications: Application[]): Promise<IntentResolution> {
        // Show resolver
        const selection: ResolverResult | null = await this._resolver.handleIntent(intent, applications).catch((e) => {
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

    private async fireIntent(intent: Intent, appInfo: Application): Promise<IntentResolution> {
        const listeningWindows = await this._model.expectWindowsForApp(
            appInfo,
            (window) => window.hasIntentListener(intent.type),
            (window) => window.waitForReadyToReceiveIntent(intent.type)
        );

        let data: unknown = undefined;

        if (listeningWindows.length > 0) {
            const payload: ReceiveIntentPayload = {context: intent.context, intent: intent.type};

            const [result, returnData] = await collateClientCalls(listeningWindows.map((window) => {
                return this._apiHandler.dispatch(window.identity, APIToClientTopic.RECEIVE_INTENT, payload);
            }));
            data = returnData;

            if (result === ClientCallsResult.ALL_FAILURE) {
                throw new FDC3Error(SendContextError.HandlerError, 'Error(s) thrown by application attempting to handle intent');
            } else if (result === ClientCallsResult.TIMEOUT) {
                throw new FDC3Error(SendContextError.HandlerTimeout, 'Timeout waiting for application to handle intent');
            }
        } else {
            throw new FDC3Error(SendContextError.NoHandler, `Application has no handler for intent '${intent.type}'`);
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
