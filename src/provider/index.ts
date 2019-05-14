import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {RaiseIntentPayload, APIFromClientTopic, OpenPayload, FindIntentPayload, FindIntentsByContextPayload, BroadcastPayload, APIFromClient, GetAllChannelsPayload, JoinChannelPayload, GetChannelPayload, GetChannelMembersPayload, IntentListenerPayload} from '../client/internal';
import {AppIntent, IntentResolution, Application, Intent, Channel} from '../client/main';
import {FDC3Error, ResolveError, OpenError} from '../client/errors';

import {Inject} from './common/Injectables';
import {AppDirectory} from './model/AppDirectory';
import {FindFilter, Model} from './model/Model';
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
    private _apiHandler!: APIHandler<APIFromClientTopic>;

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
        this._apiHandler.registerListeners<APIFromClient>({
            [APIFromClientTopic.OPEN]: this.open.bind(this),
            [APIFromClientTopic.FIND_INTENT]: this.findIntent.bind(this),
            [APIFromClientTopic.FIND_INTENTS_BY_CONTEXT]: this.findIntentsByContext.bind(this),
            [APIFromClientTopic.BROADCAST]: this.broadcast.bind(this),
            [APIFromClientTopic.RAISE_INTENT]: this.raiseIntent.bind(this),
            [APIFromClientTopic.ADD_INTENT_LISTENER]: this.addIntentListener.bind(this),
            [APIFromClientTopic.REMOVE_INTENT_LISTENER]: this.removeIntentListener.bind(this),
            [APIFromClientTopic.GET_ALL_CHANNELS]: this.getAllChannels.bind(this),
            [APIFromClientTopic.JOIN_CHANNEL]: this.joinChannel.bind(this),
            [APIFromClientTopic.GET_CHANNEL]: this.getChannel.bind(this),
            [APIFromClientTopic.GET_CHANNEL_MEMBERS]: this.getChannelMembers.bind(this)
        });

        console.log('Service Initialised');
    }

    private async open(payload: OpenPayload): Promise<void> {
        const appInfo: Application|null = await this._directory.getAppByName(payload.name);

        if (!appInfo) {
            throw new FDC3Error(OpenError.AppNotFound, `No app in directory with name: ${payload.name}`);
        }

        // This can throw FDC3Error's if app fails to open
        const appWindow = await this._model.findOrCreate(appInfo, FindFilter.WITH_CONTEXT_LISTENER);

        if (payload.context) {
            if (!payload.context.type) {
                throw new FDC3Error(OpenError.InvalidContext, `Context not valid. context = ${JSON.stringify(payload.context)}`);
            }
            await this._contexts.send(appWindow, payload.context);
        }
    }

    private async findIntent(payload: FindIntentPayload): Promise<AppIntent> {
        let apps: Application[];
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
        if (payload.context && payload.context.type) {
            return this._directory.getAppIntentsByContext(payload.context.type);
        } else {
            throw new FDC3Error(ResolveError.InvalidContext, `Context not valid. context = ${JSON.stringify(payload.context)}`);
        }
    }

    private async broadcast(payload: BroadcastPayload, source: ProviderIdentity): Promise<void> {
        await this._contexts.broadcast(payload.context, source);
    }

    private async raiseIntent(payload: RaiseIntentPayload): Promise<IntentResolution> {
        const intent: Intent = {
            type: payload.intent,
            context: payload.context,
            target: payload.target
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

    private async addIntentListener(payload: IntentListenerPayload, identity: ProviderIdentity): Promise<void> {
        const appWindow = this._model.getWindow(identity);
        if (appWindow) {
            appWindow.addIntentListener(payload.intent);
            return Promise.resolve();
        } else {
            // TODO? Should this be an `AppNotFound` (or other) FDC3Error? Or is the model an implementation detail?
            throw new Error('App not found in model');
        }
    }

    private async removeIntentListener(payload: IntentListenerPayload, identity: ProviderIdentity): Promise<void> {
        const appWindow = this._model.getWindow(identity);
        if (appWindow) {
            appWindow.removeIntentListener(payload.intent);
            return Promise.resolve();
        } else {
            /* // TODO? Food for thought:
                - Should this be an `AppNotFound` (or other) FDC3Error? Or is the model an implementation detail irrelevant to the client app?
                - Should fail silently instead? Perhaps removing an intent listener for a window not found in the model is not too critical
                    (and would be an extremely rare case)
            */
            throw new Error('App not found in model');
        }
    }
}

// Start service provider
Injector.getClass(Main).register();
