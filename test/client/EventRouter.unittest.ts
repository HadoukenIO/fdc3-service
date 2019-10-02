import {EventEmitter} from 'events';

import {EventRouter, Transport, Targeted} from '../../src/client/EventRouter';
import {ChannelChangedEvent} from '../../src/client/main';
import {Events} from '../../src/client/internal';
import {getEventRouter} from '../../src/client/connection';

let eventRouter: EventRouter<Events>;

beforeEach(() => {
    eventRouter = new EventRouter(new EventEmitter());
});

it('getEventRouter returns without error', () => {
    expect(getEventRouter()).toBeInstanceOf(EventRouter);
});

it('Subsequent calls to getEventRouter return the same EventRouter', () => {
    const eventRouter1 = getEventRouter();
    const eventRouter2 = getEventRouter();

    expect(eventRouter2).toBe(eventRouter1);
});

it('When provided with an Emitter provider, and a deserializer, a matching event is emitted as expected', () => {
    const deserializer = jest.fn<ChannelChangedEvent, [Transport<Events>]>();
    const emitterProvider = jest.fn<EventEmitter, [string]>();

    const deserializedEvent = {type: 'channel-changed' as 'channel-changed', identity: {uuid: 'test', name: 'test'}, channel: null, previousChannel: null};
    const emitter = new EventEmitter();

    const emitterHandler = jest.fn<void, [ChannelChangedEvent]>();
    emitter.addListener('channel-changed', emitterHandler);

    deserializer.mockReturnValue(deserializedEvent);
    emitterProvider.mockReturnValue(emitter);

    eventRouter.registerDeserializer('channel-changed', deserializer);
    eventRouter.registerEmitterProvider('test-target-type', emitterProvider);

    const transportEvent: Transport<Events> = {
        type: 'channel-changed' as 'channel-changed',
        identity: {uuid: 'test', name: 'test'},
        channel: null,
        previousChannel: null
    };
    const serializedEvent: Targeted<Transport<Events>> = {
        target: {type: 'test-target-type', id: 'test-target-id'},
        ...transportEvent
    };

    eventRouter.dispatchEvent(serializedEvent);

    expect(deserializer).toBeCalledWith(transportEvent);
    expect(emitterProvider).toBeCalledWith('test-target-id');
    expect(emitterHandler).toBeCalledWith(deserializedEvent);
});
