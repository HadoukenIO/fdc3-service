import {ChannelTransport, DesktopChannelTransport} from '../../client/internal';
import {ChannelId, Context, Channel, DesktopChannel, DefaultChannel, ChannelBase} from '../../client/main';
import {Transport} from '../../client/EventRouter';

export interface ContextChannel {
    readonly id: ChannelId;
    readonly type: string;

    setLastBroadcastContext(context: Context): void;
    getStoredContext(): Context | null;
    clearStoredContext(): void;

    serialize(): Transport<Channel>;
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

    public serialize(): Transport<ChannelBase> {
        return {
            id: this.id,
            type: this.type
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

    // public serialize(): Transport<DefaultChannel> {
    //     return {
    //         id: this.id,
    //         type: this.type
    //     };
    // }
}

export class DesktopContextChannel extends ContextChannelBase {
    public readonly type!: 'desktop';
    public readonly name: string;
    public readonly color: number;

    private _context: Context | null;

    public constructor(id: ChannelId, name: string, color: number) {
        super(id, 'desktop');

        this.name = name;
        this.color = color;

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

    public serialize(): Transport<DesktopChannel> {
        const base: ChannelTransport = super.serialize();
        return {...base, type: this.type, name: this.name, color: this.color};
    }
}
