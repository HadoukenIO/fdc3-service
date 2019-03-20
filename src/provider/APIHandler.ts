import {ProviderIdentity} from 'openfin/_v2/api/interappbus/channel/channel';
import {ChannelProvider} from 'openfin/_v2/api/interappbus/channel/provider';
import {Identity} from 'openfin/_v2/main';

import {SERVICE_CHANNEL} from '../client/internal';

export type ActionHandler<T extends Actions, Actions extends string, Payloads extends {[K in Actions]: unknown}, Responses extends {[K in Actions]: unknown}> =
    (() => Promise<Responses[T]>)|((payload: Payloads[T]) => Promise<Responses[T]>)|((payload: Payloads[T], source: ProviderIdentity) => Promise<Responses[T]>);

export type ActionHandlerMap<Actions extends string, Payloads extends {[K in Actions]: unknown}, Responses extends {[K in Actions]: unknown}> = {
    [T in Actions]: ActionHandler<T, Actions, Payloads, Responses>
};


export class APIHandler<A extends string, P extends {[K in A]: unknown}, R extends {[K in A]: unknown}> {
    private _providerChannel!: ChannelProvider;

    public get channel(): ChannelProvider {
        return this._providerChannel;
    }

    public isClientConnection(identity: Identity): boolean {
        return this._providerChannel.connections.some((conn: Identity) => {
            return identity.uuid === conn.uuid && identity.name === conn.name;
        });
    }

    public getClientConnections(): Identity[] {
        return this._providerChannel.connections;
    }

    public async registerListeners(actionHandlerMap: ActionHandlerMap<A, P, R>): Promise<void> {
        const providerChannel: ChannelProvider = this._providerChannel = await fin.InterApplicationBus.Channel.create(SERVICE_CHANNEL);

        providerChannel.onConnection(this.onConnection);

        for (const action in actionHandlerMap) {
            if (actionHandlerMap.hasOwnProperty(action)) {
                const handler = actionHandlerMap[action];
                this.registerAction(action, handler);
            }
        }
    }

    private registerAction<T extends A>(action: T, handler: ActionHandler<T, A, P, R>): void {
        handler = handler.bind(this) as typeof handler;  // Installed version of TS does not know typings for bind. Re-check on TS upgrades.

        this._providerChannel.register(action, handler);
    }

    // TODO?: Remove the need for this any by defining connection payload type?
    // tslint:disable-next-line:no-any
    private onConnection(app: Identity, payload?: any): void {
        if (payload && payload.version && payload.version.length > 0) {
            console.log(`connection from client: ${app.name}, version: ${payload.version}`);
        } else {
            console.log(`connection from client: ${app.name}, unable to determine version`);
        }
    }
}
