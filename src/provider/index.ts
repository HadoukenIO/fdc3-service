import 'reflect-metadata';

import {injectable, inject} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {RaiseIntentPayload, APITopic, OpenPayload, FindIntentPayload, FindIntentsByContextPayload, BroadcastPayload, API, GetAllChannelsPayload, JoinChannelPayload, GetChannelPayload, GetChannelMembersPayload} from '../client/internal';
import {AppIntent, IntentResolution, Application, Intent, Channel} from '../client/main';

import {Inject} from './common/Injectables';
import {AppDirectory} from './model/AppDirectory';
import {Model, FindFilter} from './model/Model';
import {ContextHandler} from './controller/ContextHandler';
import {IntentHandler} from './controller/IntentHandler';
import {APIHandler} from './APIHandler';
import {Injector} from './common/Injector';

@injectable()
export class Main {
    private _config = null;

    @inject(Inject.APP_DIRECTORY)
    private _directory!: AppDirectory;

    @inject(Inject.MODEL)
    private _model!: Model;

    @inject(Inject.CONTEXT_HANDLER)
    private _contexts!: ContextHandler;

    @inject(Inject.INTENT_HANDLER)
    private _intents!: IntentHandler;

    @inject(Inject.API_HANDLER)
    private _apiHandler!: APIHandler<APITopic>;

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
        this._apiHandler.registerListeners<API>({
            [APITopic.OPEN]: this.open.bind(this),
            [APITopic.FIND_INTENT]: this.findIntent.bind(this),
            [APITopic.FIND_INTENTS_BY_CONTEXT]: this.findIntentsByContext.bind(this),
            [APITopic.BROADCAST]: this.broadcast.bind(this),
            [APITopic.RAISE_INTENT]: this.raiseIntent.bind(this),
            [APITopic.GET_ALL_CHANNELS]: this.getAllChannels.bind(this),
            [APITopic.JOIN_CHANNEL]: this.joinChannel.bind(this),
            [APITopic.GET_CHANNEL]: this.getChannel.bind(this),
            [APITopic.GET_CHANNEL_MEMBERS]: this.getChannelMembers.bind(this)
        });

        console.log('Service Initialised');
    }

    private async open(payload: OpenPayload): Promise<void> {
        const appInfo: Application|null = await this._directory.getAppByName(payload.name);

        if (appInfo) {
            const app = await this._model.findOrCreate(appInfo, FindFilter.WITH_CONTEXT_LISTENER);

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

    private async broadcast(payload: BroadcastPayload, source: ProviderIdentity): Promise<void> {
        await this._contexts.broadcast(payload.context, source);
    }

    private async raiseIntent(payload: RaiseIntentPayload): Promise<IntentResolution> {
        const intent: Intent = {
            type: payload.intent,
            context: payload.context
        };

        return this._intents.raise(intent);
    }

    private async getAllChannels(payload: GetAllChannelsPayload, source: ProviderIdentity): Promise<Channel[]> {
        return this._contexts.getAllChannels(payload, source);
    }

    private async joinChannel(payload: JoinChannelPayload, source: ProviderIdentity): Promise<void> {
        return this._contexts.joinChannel(payload, source);
    }

    private async getChannel(payload: GetChannelPayload, source: ProviderIdentity): Promise<Channel> {
        return this._contexts.getChannel(payload, source);
    }

    private async getChannelMembers(payload: GetChannelMembersPayload, source: ProviderIdentity): Promise<Identity[]> {
        return this._contexts.getChannelMembers(payload, source);
    }
}

// Start service provider
Injector.getClass(Main).register();
