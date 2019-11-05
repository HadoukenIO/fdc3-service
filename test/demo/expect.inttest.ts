import 'reflect-metadata';
import {WindowEvent} from 'openfin/_v2/api/events/base';

import {DeferredPromise} from '../../src/provider/common/DeferredPromise';
import {getId} from '../../src/provider/utils/getId';

import {testAppNotInDirectory1, appStartupTime, testManagerIdentity} from './constants';
import {setupTeardown} from './utils/common';
import * as fdc3Remote from './utils/fdc3RemoteExecution';
import {RemoteChannel} from './utils/RemoteChannel';
import {fin} from './utils/fin';

type WindowCreatedEvent = WindowEvent<'system', 'window-created'>;

setupTeardown();

let targetChannel: RemoteChannel;
let channelJoinedPromise: DeferredPromise;
let windowCreatedHandler: (event: WindowCreatedEvent) => void;

beforeAll(async () => {
    targetChannel = await fdc3Remote.getChannelById(testManagerIdentity, 'green');

    windowCreatedHandler = (event: WindowCreatedEvent) => {
        if (getId(event) === getId(testAppNotInDirectory1)) {
            targetChannel.join(testAppNotInDirectory1).then(() => {
                channelJoinedPromise.resolve();
            });
        }
    };

    await fin.System.addListener('window-created', windowCreatedHandler);
});

afterAll(async () => {
    await fin.System.removeListener('window-created', windowCreatedHandler);
});

beforeEach(() => {
    channelJoinedPromise = new DeferredPromise();
});

afterEach(async () => {
    await fin.Application.wrapSync(testAppNotInDirectory1).quit(true);
});

test('When starting an app, the app can be interacted with as soon as a `window-created` event is received', async () => {
    const startPromise = fin.Application.startFromManifest(testAppNotInDirectory1.manifestUrl);

    await channelJoinedPromise.promise;

    await expect(fdc3Remote.getCurrentChannel(testManagerIdentity, testAppNotInDirectory1)).resolves.toBe(targetChannel);

    await startPromise;
}, appStartupTime);
