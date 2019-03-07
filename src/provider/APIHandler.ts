import { APITopic, TopicResponseMap, TopicPayloadMap, Handler } from "../client/internal";
import { ChannelProvider } from "openfin/_v2/api/interappbus/channel/provider";
import { Identity } from "openfin/_v2/main";
import { ProviderIdentity } from "openfin/_v2/api/interappbus/channel/channel";


export class APIHandler {
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

    public async registerListeners(): Promise<void> {
        
    }

    private registerAction<T extends APITopic>(action: T, handler: Handler<T>): void { 
        handler = handler.bind(this) as typeof handler; // Installed version of TS does not know typings for bind. Re-check on TS upgrades.

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

