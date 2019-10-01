import {ChannelId, Context, DisplayMetadata, Channel, ChannelBase, SystemChannel, AppChannel} from '../../client/main';
import {Transport} from '../../client/EventRouter';

export interface ContextChannel {
    readonly id: ChannelId;
    readonly type: string;

    setLastBroadcastContext(context: Context): void;
    getStoredContext(): Context | null;
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

    public abstract getStoredContext(): Context | null;
    public abstract setLastBroadcastContext(context: Context): void;
    public abstract clearStoredContext(): void;

    public serialize(): Readonly<Transport<ChannelBase>> {
        return {
            id: this.id,
            type: this.type
        };
    }
}

export class SystemContextChannel extends ContextChannelBase {
    public readonly type!: 'system';

    public readonly visualIdentity: DisplayMetadata;

    private _context: Context | null;

    public constructor(id: ChannelId, visualIdentity: DisplayMetadata) {
        super(id, 'system');

        this.visualIdentity = visualIdentity;

        this._context = null;
    }

    public getStoredContext(): Context | null {
        return this._context;
    }

    public setLastBroadcastContext(context: Context) {
        this._context = context;
    }

    public clearStoredContext(): void {
        this._context = null;
    }

    public serialize(): Readonly<Transport<SystemChannel>> {
        return {
            ...super.serialize(),
            type: this.type,
            visualIdentity: this.visualIdentity
        };
    }
}

export class DefaultContextChannel extends ContextChannelBase {
    public readonly type!: 'default';

    public constructor(id: ChannelId) {
        super(id, 'default');
    }

    public getStoredContext(): Context | null {
        return null;
    }

    public setLastBroadcastContext(context: Context) {
    }

    public clearStoredContext(): void {
    }
}

export class AppContextChannel extends ContextChannelBase {
    public readonly type!: 'app';
    public readonly name: string;

    private _context: Context | null;

    public constructor(id: ChannelId, name: string) {
        super(id, 'app');

        this.name = name;

        this._context = null;
    }

    public getStoredContext(): Context | null {
        return this._context;
    }

    public setLastBroadcastContext(context: Context) {
        this._context = context;
    }

    public clearStoredContext(): void {
        this._context = null;
    }

    public serialize(): Readonly<Transport<AppChannel>> {
        return {
            ...super.serialize(),
            type: this.type,
            name: this.name
        };
    }
}
