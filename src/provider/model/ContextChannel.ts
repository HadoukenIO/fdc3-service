import {ChannelId, Context, DisplayMetadata, Channel, ChannelBase, SystemChannel, AppChannel} from '../../client/main';
import {Transport} from '../../client/EventRouter';

export interface ContextChannel {
    readonly id: ChannelId;
    readonly type: string;

    readonly storedContext: Context | null;

    setLastBroadcastContext(context: Context): void;
    clearStoredContext(): void;

    serialize(): Readonly<Transport<Channel>>;
}

abstract class ContextChannelBase implements ContextChannel {
    public readonly id: ChannelId;
    public readonly type: string;

    constructor(id: ChannelId, type: string) {
        this.id = id;
        this.type = type;
    }

    public serialize(): Readonly<Transport<ChannelBase>> {
        return {
            id: this.id,
            type: this.type
        };
    }

    public abstract get storedContext(): Context | null;

    public abstract setLastBroadcastContext(context: Context): void;
    public abstract clearStoredContext(): void;
}

abstract class ContextStoringContextChannel extends ContextChannelBase {
    private _context: Context | null;

    public constructor(id: ChannelId, type: string) {
        super(id, type);

        this._context = null;
    }

    public get storedContext(): Context | null {
        return this._context;
    }

    public setLastBroadcastContext(context: Context) {
        this._context = context;
    }

    public clearStoredContext(): void {
        this._context = null;
    }
}

export class DefaultContextChannel extends ContextChannelBase {
    public readonly type!: 'default';

    public constructor(id: ChannelId) {
        super(id, 'default');
    }

    public get storedContext(): Context | null {
        return null;
    }

    public setLastBroadcastContext(context: Context) {}

    public clearStoredContext(): void {}
}

export class SystemContextChannel extends ContextStoringContextChannel {
    public readonly type!: 'system';
    public readonly visualIdentity: DisplayMetadata;

    public constructor(id: ChannelId, visualIdentity: DisplayMetadata) {
        super(id, 'system');

        this.visualIdentity = visualIdentity;
    }

    public serialize(): Readonly<Transport<SystemChannel>> {
        return {
            ...super.serialize(),
            type: this.type,
            visualIdentity: this.visualIdentity
        };
    }
}

export class AppContextChannel extends ContextStoringContextChannel {
    public readonly type!: 'app';
    public readonly name: string;

    public constructor(id: ChannelId, name: string) {
        super(id, 'app');

        this.name = name;
    }

    public serialize(): Readonly<Transport<AppChannel>> {
        return {
            ...super.serialize(),
            type: this.type,
            name: this.name
        };
    }
}
