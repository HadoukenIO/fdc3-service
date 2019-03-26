import 'reflect-metadata';

import {RaiseIntentPayload, APITopic, OpenPayload, FindIntentPayload, FindIntentsByContextPayload, BroadcastPayload} from '../client/internal';
import {AppIntent, IntentResolution, Application, Intent} from '../client/main';

import {injectable, inject} from 'inversify';
import {Inject} from './util/Injectables';
import {AppDirectory} from './model/AppDirectory';
import {Model, FindFilter} from './model/Model';
import {ContextHandler} from './controller/ContextHandler';
import {IntentHandler} from './controller/IntentHandler';
import {APIHandler} from './APIHandler';
import {Injector} from './util/Injector';

interface API {
    [APITopic.OPEN]: [OpenPayload, void];
    [APITopic.FIND_INTENT]: [FindIntentPayload, AppIntent];
    [APITopic.FIND_INTENTS_BY_CONTEXT]: [FindIntentsByContextPayload, AppIntent[]];
    [APITopic.BROADCAST]: [BroadcastPayload, void];
    [APITopic.RAISE_INTENT]: [RaiseIntentPayload, IntentResolution];
}

@injectable()
export class Main {
    private _config = null;

    @inject(Inject.APP_DIRECTORY)   private _directory!: AppDirectory;
    @inject(Inject.MODEL)           private _model!: Model;

    @inject(Inject.CONTEXT_HANDLER) private _contexts!: ContextHandler;
    @inject(Inject.INTENT_HANDLER)  private _intents!: IntentHandler;

    private apiHandler: APIHandler<APITopic>;

    constructor() {
        this.apiHandler = new APIHandler();
    }

    public async register(): Promise<void> {
        Object.assign(window, {
            main: this,
            config: this._config,
            directory: this._directory,
            model: this._model,
            contexts: this._contexts,
            intents: this._intents
        });

        // Wait for creation of any injected components that require async initialization
        await Injector.initialized;

        // Current API
        this.apiHandler.registerListeners<API>({
            [APITopic.OPEN]: this.onOpen.bind(this),
            [APITopic.FIND_INTENT]: this.findIntent.bind(this),
            [APITopic.FIND_INTENTS_BY_CONTEXT]: this.findIntentsByContext.bind(this),
            [APITopic.BROADCAST]: this.broadcast.bind(this),
            [APITopic.RAISE_INTENT]: this.raiseIntent.bind(this)
        });

        console.log('Service Initialised');
    }

    private async onOpen(payload: OpenPayload): Promise<void> {
        const appInfo: Application|null = await this._directory.getAppByName(payload.name);

        if (appInfo) {
            const app = await this._model.findOrCreate(appInfo, {prefer: FindFilter.WITH_CONTEXT_LISTENER});

            if (payload.context) {
                await this._contexts.send(app, payload.context);
            }
        } else {
            throw new Error(`No app in directory with name: ${payload.name}`);
        }
    }

    private async findIntent(payload: FindIntentPayload): Promise<AppIntent> {
        let apps;
        if (payload.intent) {
            apps = await this._directory.getAppsByIntent(payload.intent);
        } else {
            apps = await this._directory.getAllApps();
        }

        return {
            intent: {
                name: payload.intent,
                displayName: payload.intent
            },
            apps
        };
    }

    private async findIntentsByContext (payload: FindIntentsByContextPayload): Promise<AppIntent[]> {
        return [];
    }

    private async broadcast(payload: BroadcastPayload): Promise<void> {
        await this._contexts.broadcast(payload.context);
    }

    private async raiseIntent(payload: RaiseIntentPayload): Promise<IntentResolution> {
        const intent: Intent = {
            type: payload.intent,
            context: payload.context
        };

        return this._intents.raise(intent);
    }
}

// Start service provider
Injector.getClass(Main).register();
