import {EventEmitter} from 'events';

import {FDC3Event, FDC3EventType} from './main';
import {EventTransport} from './internal';

let eventHandler: EventRouter | null;

/**
 * @hidden
 */
export function getEventRouter(): EventRouter {
    if (!eventHandler) {
        eventHandler = new EventRouter();
    }

    return eventHandler;
}

/**
 * @hidden
 */
export class EventRouter {
    private readonly _emitterProviders: {[targetType: string]: (targetId: string) => EventEmitter};
    private readonly _deserializers: {[eventType: string]: (event: EventTransport<FDC3Event>) => FDC3Event};

    public constructor() {
        this._emitterProviders = {};
        this._deserializers = {};
    }

    public registerEmitterProvider(targetType: string, emitterProvider: (targetId: string) => EventEmitter): void {
        this._emitterProviders[targetType] = emitterProvider;
    }

    public registerDeserializer(eventType: FDC3EventType, handler: (event: EventTransport<FDC3Event>) => FDC3Event): void {
        this._deserializers[eventType] = handler;
    }

    public dispatchEvent(event: EventTransport<FDC3Event>): void {
        const deserializer = this._deserializers[event.type];

        const deserializedEvent = deserializer(event);

        const emitter = this._emitterProviders[event.target.type](event.target.id);

        emitter.emit(event.type, deserializedEvent);
    }
}
