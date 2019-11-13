import {injectable, inject} from 'inversify';

import {Inject} from '../common/Injectables';
import {Intent} from '../intents';
import {IntentResolution, Application} from '../../client/main';
import {FDC3Error, ResolveError, ResolveErrorMessage} from '../../client/errors';
import {Model} from '../model/Model';
import {APIToClientTopic, ReceiveIntentPayload} from '../../client/internal';
import {APIHandler} from '../APIHandler';
import {raceUntilTrue, withTimeout} from '../utils/async';
import {Timeouts} from '../constants';

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
                ResolveError.TargetAppDoesNotHandleIntent,
                `App '${intent.target}' does not handle intent '${intent.type}' with context '${intent.context.type}'`
            );
        } else {
            // Target does not exist
            throw new FDC3Error(
                ResolveError.TargetAppNotAvailable,
                `Couldn't resolve intent target '${intent.target}'. No matching app in directory or currently running.`
            );
        }
    }

    private async startResolve(
        intent: Intent,
        handleAppChoice: (intent: Intent, apps: Application[]) => Promise<IntentResolution>
    ): Promise<IntentResolution> {
        const apps: Application[] = await this._model.getApplicationsForIntent(intent.type, intent.context.type);

        if (apps.length === 0) {
            throw new FDC3Error(ResolveError.NoAppsFound, 'No applications available to handle this intent');
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

        let promises = [];
        if (listeningWindows.length > 0) {
            const payload: ReceiveIntentPayload = {context: intent.context, intent: intent.type};
            promises = listeningWindows.map((window) => this._apiHandler.dispatch(window.identity, APIToClientTopic.RECEIVE_INTENT, payload));
        } else {
            throw new FDC3Error(ResolveError.IntentTimeout, `Timeout waiting for intent listener to be added for intent: ${intent.type}`);
        }

        let data: unknown;
        let didTimeout = false;
        try {
            // Use the first handler return data that matches the predicate
            [didTimeout, data] = await withTimeout(Timeouts.INTENT_RESOLUTION, raceUntilTrue(promises, returnValuePredicate));
        } catch (error) {
            throw new FDC3Error(ResolveError.IntentHandlerException, `${ResolveErrorMessage[ResolveError.IntentHandlerException]} ${appInfo.name}`);
        }
        if (didTimeout) {
            throw new FDC3Error(ResolveError.IntentTimeout, `Timeout waiting for intent listener return for intent: ${intent.type}`);
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
    return value !== undefined;
}
