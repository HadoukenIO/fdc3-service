import {injectable, inject} from 'inversify';

import {Inject} from '../common/Injectables';
import {Intent} from '../../client/intents';
import {IntentResolution, Application} from '../../client/main';
import {FDC3Error, ResolveError} from '../../client/errors';
import {Model} from '../model/Model';
import {AppDirectory} from '../model/AppDirectory';
import {AppWindow} from '../model/AppWindow';
import {APIToClientTopic} from '../../client/internal';
import {APIHandler} from '../APIHandler';

import {ResolverHandler, ResolverResult} from './ResolverHandler';

@injectable()
export class IntentHandler {
    private readonly _directory: AppDirectory;
    private readonly _model: Model;
    private readonly _resolver: ResolverHandler;
    private readonly _apiHandler: APIHandler<APIToClientTopic>;

    private _resolvePromise: Promise<IntentResolution>|null;

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.MODEL) model: Model,
        @inject(Inject.RESOLVER) resolver: ResolverHandler,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIToClientTopic>,
    ) {
        this._directory = directory;
        this._model = model;
        this._resolver = resolver;
        this._apiHandler = apiHandler;

        this._resolvePromise = null;
    }

    public async raise(intent: Intent): Promise<IntentResolution> {
        if (hasTarget(intent)) {
            return this.raiseWithTarget(intent);
        }

        const apps: Application[] = await this._model.getApplicationsForIntent(intent.type);

        if (apps.length === 0) {
            throw new FDC3Error(ResolveError.NoAppsFound, 'No applications available to handle this intent');
        } else if (apps.length === 1) {
            // Resolve intent immediately
            return this.fireIntent(intent, apps[0]);
        } else {
            // Prompt the user to select an application to use
            return this.queueResolve(intent);
        }
    }

    private async raiseWithTarget(intent: IntentWithTarget): Promise<IntentResolution> {
        let appInfo: Application|null;

        const appWindows = this._model.findWindowsByAppName(intent.target);

        if (appWindows.length > 0) {
            // Target app is running -> fire intent at it
            appInfo = appWindows[0].appInfo;
        } else {
            // Target app not running -> Try to find in directory
            appInfo = await this._directory.getAppByName(intent.target);
            if (!appInfo) {
                throw new FDC3Error(
                    ResolveError.TargetAppNotAvailable,
                    `Couldn't resolve intent target '${intent.target}'. No matching app in directory or currently running.`
                );
            }

            // Target app is in directory -> ensure that it handles intent
            if (!(appInfo.intents || []).some(appIntent => appIntent.name === intent.type)) {
                throw new FDC3Error(ResolveError.TargetAppDoesNotHandleIntent, `App '${intent.target}' does not handle intent '${intent.type}'`);
            }
        }

        // At this point we are certain that the target app - whether already running or not - can handle the intent
        return this.fireIntent(intent, appInfo);
    }

    private async queueResolve(intent: Intent): Promise<IntentResolution> {
        if (this._resolvePromise) {
            this._resolvePromise = this._resolvePromise.catch(() => {}).then(() => this.startResolve(intent));
        } else {
            this._resolvePromise = this.startResolve(intent);
        }

        return this._resolvePromise;
    }

    private async startResolve(intent: Intent): Promise<IntentResolution> {
        console.log('Handling intent', intent.type);

        // Show resolver
        const selection: ResolverResult|null = await this._resolver.handleIntent(intent).catch(e => {
            console.warn(e);
            return null;
        });
        if (!selection) {
            throw new FDC3Error(ResolveError.ResolverClosedOrCancelled, 'Resolver closed or cancelled');
        }

        // Handle response
        console.log('Selected from resolver:', selection.app.title);
        return this.fireIntent(intent, selection.app);
    }

    private async fireIntent(intent: Intent, appInfo: Application): Promise<IntentResolution> {
        const appWindows = await this._model.findOrCreate(appInfo);
        // to decide between focus nothing or apps with intent listener
        const dispatchResults = await Promise.all(appWindows.map(async (window: AppWindow): Promise<boolean> => {
            if (await window.isReadyToReceiveIntent(intent.type)) {
                // TODO: Implement a timeout so a misbehaving intent handler can't block the intent raiser (SERVICE-555)
                await this._apiHandler.channel.dispatch(window.identity, APIToClientTopic.INTENT, {context: intent.context, intent: intent.type});
                return true;
            } else {
                return false;
            }
        }));

        if (!dispatchResults.some(dispatchResult => dispatchResult)) {
            throw new FDC3Error(ResolveError.IntentTimeout, `Timeout waiting for intent listener to be added for intent: ${intent.type}`);
        }

        const result: IntentResolution = {
            source: appInfo.name,
            version: '1.0.0'
        };

        // Handle next queued intent
        console.log('Finished intent', intent.type);

        return result;
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
