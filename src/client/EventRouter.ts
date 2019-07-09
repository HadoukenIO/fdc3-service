/**
 * @hidden
 */

/**
  * Class for hepling take events that have arrived at the client via the IAB channel, and dispatching them on the correct client-side object
  */
import {EventEmitter} from 'events';

import {FDC3Event} from './main';
import {EventTransport} from './internal';

let eventHandler: EventRouter | null;

type EventDeserializer<E extends FDC3Event> = (event: EventTransport<E>) => E;

export function getEventRouter(): EventRouter {
    if (!eventHandler) {
        eventHandler = new EventRouter();
    }

    return eventHandler;
}

export class EventRouter {
    private readonly _emitterProviders: {[targetType: string]: (targetId: string) => EventEmitter};
    private readonly _deserializers: {[eventType: string]: EventDeserializer<FDC3Event>};

    public constructor() {
        this._emitterProviders = {};
        this._deserializers = {};
    }

    public registerEmitterProvider(targetType: string, emitterProvider: (targetId: string) => EventEmitter): void {
        this._emitterProviders[targetType] = emitterProvider;
    }

    public registerDeserializer<E extends FDC3Event>(eventType: E['type'], deserializer: EventDeserializer<E>): void {
        this._deserializers[eventType] = deserializer as unknown as EventDeserializer<FDC3Event>;
    }

    public dispatchEvent(event: EventTransport<FDC3Event>): void {
        const deserializer = this._deserializers[event.type];

        const deserializedEvent = deserializer(event);

        const emitter = this._emitterProviders[event.target.type](event.target.id);

        emitter.emit(event.type, deserializedEvent);
    }
}
