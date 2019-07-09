import {EventEmitter} from 'events';

import {getEventRouter, EventRouter} from '../../src/client/EventRouter';
import {EventTransport} from '../../src/client/internal';
import {ChannelChangedEvent, FDC3Event} from '../../src/client/main';

let eventRouter: EventRouter;

beforeEach(() => {
    eventRouter = new EventRouter();
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
    const deserializer = jest.fn<ChannelChangedEvent, [EventTransport<FDC3Event>]>();
    const emitterProvider = jest.fn<EventEmitter, [string]>();

    const deserializedEvent = {type: 'channel-changed' as 'channel-changed', identity: {uuid: 'test', name: 'test'}, channel: null, previousChannel: null};
    const emitter = new EventEmitter();

    const emitterHandler = jest.fn<void, [ChannelChangedEvent]>();
    emitter.addListener('channel-changed', emitterHandler);

    deserializer.mockReturnValue(deserializedEvent);
    emitterProvider.mockReturnValue(emitter);

    eventRouter.registerDeserializer('channel-changed', deserializer);
    eventRouter.registerEmitterProvider('test-target-type', emitterProvider);

    const serializedEvent: EventTransport<FDC3Event> = {
        target: {type: 'test-target-type', id: 'test-target-id'},
        type: 'channel-changed' as 'channel-changed',
        identity: {uuid: 'test', name: 'test'},
        channel: null,
        previousChannel: null
    };

    eventRouter.dispatchEvent(serializedEvent);

    expect(deserializer).toBeCalledWith(serializedEvent);
    expect(emitterProvider).toBeCalledWith('test-target-id');
    expect(emitterHandler).toBeCalledWith(deserializedEvent);
});
