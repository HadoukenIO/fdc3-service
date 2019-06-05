import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {Identity} from 'openfin/_v2/main';
import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';

import {RaiseIntentPayload, APIFromClientTopic, OpenPayload, FindIntentPayload, FindIntentsByContextPayload, BroadcastPayload, APIFromClient, IntentListenerPayload, GetDesktopChannelsPayload, GetCurrentChannelPayload, ChannelGetMembersPayload, ChannelJoinPayload, ChannelTransport, DesktopChannelTransport, GetChannelByIdPayload, EventTransport} from '../client/internal';
import {AppIntent, IntentResolution, Application, Intent, ChannelChangedEvent} from '../client/main';
import {FDC3Error, ResolveError, OpenError, IdentityError} from '../common/errors';
import {parseIdentity} from '../common/validation';

import {Inject} from './common/Injectables';
import {AppDirectory} from './model/AppDirectory';
import {FindFilter, Model} from './model/Model';
import {ContextHandler} from './controller/ContextHandler';
import {IntentHandler} from './controller/IntentHandler';
import {APIHandler} from './APIHandler';
import {Injector} from './common/Injector';
import {ChannelHandler} from './controller/ChannelHandler';

@injectable()
export class Main {
    private _config = null;

    private readonly _directory: AppDirectory;
    private readonly _model: Model;
    private readonly _contextHandler: ContextHandler;
    private readonly _intentHandler: IntentHandler;
    private readonly _channelHandler: ChannelHandler;
    private readonly _apiHandler: APIHandler<APIFromClientTopic>;

    constructor(
        @inject(Inject.APP_DIRECTORY) directory: AppDirectory,
        @inject(Inject.MODEL) model: Model,
        @inject(Inject.CONTEXT_HANDLER) contextHandler: ContextHandler,
        @inject(Inject.INTENT_HANDLER) intentHandler: IntentHandler,
        @inject(Inject.CHANNEL_HANDLER) channelHandler: ChannelHandler,
        @inject(Inject.API_HANDLER) apiHandler: APIHandler<APIFromClientTopic>,
    ) {
        this._directory = directory;
        this._model = model;
        this._contextHandler = contextHandler;
        this._intentHandler = intentHandler;
        this._channelHandler = channelHandler;
        this._apiHandler = apiHandler;
    }

    public async register(): Promise<void> {
        Object.assign(window, {
            main: this,
            config: this._config,
            directory: this._directory,
            model: this._model,
            contextHandler: this._contextHandler,
            intentHandler: this._intentHandler,
            channelHandler: this._channelHandler
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
            [APIFromClientTopic.GET_DESKTOP_CHANNELS]: this.getDesktopChannels.bind(this),
            [APIFromClientTopic.GET_CHANNEL_BY_ID]: this.getChannelById.bind(this),
            [APIFromClientTopic.GET_CURRENT_CHANNEL]: this.getCurrentChannel.bind(this),
            [APIFromClientTopic.CHANNEL_GET_MEMBERS]: this.channelGetMembers.bind(this),
            [APIFromClientTopic.CHANNEL_JOIN]: this.channelJoin.bind(this)
        });

        this._channelHandler.registerChannels();
        this._channelHandler.onChannelChanged.add(this.onChannelChangedHandler, this);

        console.log('Service Initialised');
    }

    private onChannelChangedHandler(event: EventTransport<ChannelChangedEvent>): void {
        this._apiHandler.channel.publish('event', event);
    }

    private async open(payload: OpenPayload): Promise<void> {
        const appInfo: Application|null = await this._directory.getAppByName(payload.name);

        if (!appInfo) {
            throw new FDC3Error(OpenError.AppNotFound, `No app in directory with name: ${payload.name}`);
        }

        // This can throw FDC3Errors if app fails to open or times out
        const appWindow = await this._model.findOrCreate(appInfo, FindFilter.WITH_CONTEXT_LISTENER);

        if (payload.context) {
            if (!payload.context.type) {
                throw new FDC3Error(OpenError.InvalidContext, `Context not valid. context = ${JSON.stringify(payload.context)}`);
            }
            this._contextHandler.send(appWindow, payload.context);
        }
    }

    /**
     * Find apps that can handle an intent.
     *
     * Includes running apps that are not registered on the directory
     * @param payload Contains the intent type to find information for
     */
    private async findIntent(payload: FindIntentPayload): Promise<AppIntent> {
        let apps: Application[];
        if (payload.intent) {
            apps = await this._model.getApplicationsForIntent(payload.intent);
        } else {
            // This is a non-FDC3 workaround to get all directory apps by calling `findIntent` with a falsy intent.
            // Ideally the FDC3 spec would expose an API to access the directory in a more meaningful way
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
        this.validateIdentity(source);
        const appWindow = this._model.getWindow(source)!;

        await this._contextHandler.broadcast(payload.context, appWindow);
    }

    private async raiseIntent(payload: RaiseIntentPayload): Promise<IntentResolution> {
        const intent: Intent = {
            type: payload.intent,
            context: payload.context,
            target: payload.target
        };

        return this._intentHandler.raise(intent);
    }

    private async addIntentListener(payload: IntentListenerPayload, identity: ProviderIdentity): Promise<void> {
        this.validateIdentity(identity);
        const appWindow = this._model.getWindow(identity)!;

        appWindow.addIntentListener(payload.intent);
    }

    private removeIntentListener(payload: IntentListenerPayload, identity: ProviderIdentity): void {
        const appWindow = this._model.getWindow(identity);
        if (appWindow) {
            appWindow.removeIntentListener(payload.intent);
        } else {
            // If for some odd reason the window is not in the model it's still OK to return successfully,
            // as the caller's intention was to remove a listener and the listener is certainly not there.
        }
    }

    private getDesktopChannels(payload: GetDesktopChannelsPayload, source: ProviderIdentity): ReadonlyArray<DesktopChannelTransport> {
        return this._channelHandler.getDesktopChannels().map(channel => channel.serialize());
    }

    private getChannelById(payload: GetChannelByIdPayload, source: ProviderIdentity): ChannelTransport {
        return this._channelHandler.getChannelById(payload.id);
    }

    private getCurrentChannel(payload: GetCurrentChannelPayload, source: ProviderIdentity): ChannelTransport {
        const identity = payload.identity || source;

        this.validateIdentity(identity);

        return this._model.getWindow(identity)!.channel.serialize();
    }

    private channelGetMembers(payload: ChannelGetMembersPayload, source: ProviderIdentity): ReadonlyArray<Identity> {
        return this._channelHandler.getChannelMembers(payload.id).map(appWindow => appWindow.identity);
    }

    private async channelJoin(payload: ChannelJoinPayload, source: ProviderIdentity): Promise<void> {
        const id = payload.id;
        const identity = payload.identity || source;

        this.validateIdentity(identity);

        this._channelHandler.joinChannel(this._model.getWindow(identity)!, id);
        const context = this._channelHandler.getChannelContext(id);

        if (context) {
            await this._contextHandler.send(identity, context);
        }
    }

    private validateIdentity(identity: Identity): void {
        identity = parseIdentity(identity);

        if (!this._model.getWindow(identity)) {
            throw new FDC3Error(
                IdentityError.WindowWithIdentityNotFound,
                `No connection to FDC3 service found from window with identity: ${JSON.stringify(identity)}`
            );
        }
    }
}

// Start service provider
Injector.getClass(Main).register();
