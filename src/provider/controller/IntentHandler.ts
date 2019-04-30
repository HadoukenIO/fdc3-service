import {injectable, inject} from 'inversify';

import {Inject} from '../common/Injectables';
import {Intent} from '../../client/intents';
import {IntentResolution, Application, FDC3Error, ResolveError} from '../../client/main';
import {FindFilter, Model} from '../model/Model';
import {AppDirectory} from '../model/AppDirectory';
import {AppWindow} from '../model/AppWindow';
import {APIToClientTopic} from '../../client/internal';
import {APIHandler} from '../APIHandler';

import {ContextHandler} from './ContextHandler';
import {SelectorHandler, SelectorResult} from './SelectorHandler';

@injectable()
export class IntentHandler {
    @inject(Inject.APP_DIRECTORY) private _directory!: AppDirectory;
    @inject(Inject.MODEL) private _model!: Model;
    @inject(Inject.SELECTOR) private _selector!: SelectorHandler;
    @inject(Inject.CONTEXT_HANDLER) private _contexts!: ContextHandler;

    private _promise: Promise<IntentResolution>|null;
    private _apiHandler: APIHandler<APIToClientTopic>;

    constructor(@inject(Inject.API_HANDLER) apiHandler: APIHandler<APIToClientTopic>) {
        this._apiHandler = apiHandler;
        this._promise = null;
    }

    public async raise(intent: Intent): Promise<IntentResolution> {
        const apps: Application[] = await this._directory.getAppsByIntent(intent.type);

        if (apps.length === 0) {
            throw new FDC3Error(ResolveError.NoAppsFound, 'No applications available to handle this intent');
        } else if (apps.length === 1) {
            // Resolve intent immediately
            return this.fireIntent(intent, apps[0]);
        } else {
            // Prompt the user to select an application to use
            return this.resolve(intent);
        }
    }

    private async resolve(intent: Intent): Promise<IntentResolution> {
        if (this._promise) {
            this._promise = this._promise!.catch(() => {}).then(() => this.startResolve(intent));
        } else {
            this._promise = this.startResolve(intent);
        }

        return this._promise;
    }

    private async startResolve(intent: Intent): Promise<IntentResolution> {
        console.log('Handling intent', intent.type);

        // Show selector
        const selection: SelectorResult|null = await this._selector.handleIntent(intent).catch(e => {
            console.warn(e);
            return null;
        });
        if (!selection) {
            throw new Error('Selector closed or cancelled');
        }

        // Handle response
        console.log('Selected from resolver:', selection.app.title);
        return this.fireIntent(intent, selection.app);
    }

    private async fireIntent(intent: Intent, appInfo: Application): Promise<IntentResolution> {
        const app: AppWindow = await this._model.findOrCreate(appInfo, FindFilter.WITH_INTENT_LISTENER);
        await app.ensureReadyToReceiveIntent(intent.type);
        const data = await this._apiHandler.channel.dispatch(app.identity, APIToClientTopic.INTENT, {context: intent.context, intent: intent.type});
        const result: IntentResolution = {
            source: appInfo.name,
            version: '1.0.0',
            data
        };

        // Handle next queued intent
        console.log('Finished intent', intent.type);

        return result;
    }
}
