import 'jest';
import 'reflect-metadata';

import {Application} from '../../src/client/directory';
import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {AppIntent} from '../../src/client/main';

const intentA = {
    name: 'testIntent.StartChat',
    contexts: ['testContext.User'],
    customConfig: {}
};
const intentB = {
    name: 'testIntent.SendEmail',
    contexts: ['testContext.User'],
    customConfig: {}
};
const intentC = {
    name: 'testIntent.StartChat',
    contexts: ['testContext.User', 'testContext.Bot'],
    customConfig: {}
};
const intentD = {
    name: 'testIntent.ShowChart',
    contexts: ['testContext.Instrument'],
    customConfig: {}
};
const fakeApp1 = {
    appId: '1',
    name: 'App 1',
    manifestType: '',
    manifest: '',
    intents: [intentA, intentB]
};
const fakeApp2 = {
    appId: '2',
    name: 'App 2',
    manifestType: '',
    manifest: '',
    intents: [intentC, intentD]
};

const fakeAppDirectory: Application[] = [fakeApp1, fakeApp2];

const mockJson = jest.fn();

beforeEach(() => {
    jest.restoreAllMocks();

    (global as any).fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: mockJson
    });
});

describe('Given an App Directory with apps', () => {
    const appDirectory = new AppDirectory();

    describe('When finding app intents by context with a context implemented by 2 intents in both apps', () => {
        beforeEach(() => {
            mockJson.mockResolvedValue(fakeAppDirectory);
        });
        it('Should return 2 intents', async () => {
            const intents = await appDirectory.getAppIntentsByContext('testContext.User');

            expect(intents).toEqual([
                {
                    intent: {name: 'testIntent.SendEmail', displayName: 'testIntent.SendEmail'},
                    apps: [fakeApp1]
                },
                {
                    intent: {name: 'testIntent.StartChat', displayName: 'testIntent.StartChat'},
                    apps: [fakeApp1, fakeApp2]
                }
            ] as AppIntent[]);
        });
    });
    describe('When finding app intents by context with a context not implemented by any intent', () => {
        beforeEach(() => {
            mockJson.mockResolvedValue(fakeAppDirectory);
        });
        it('Should return an empty array', async () => {
            const intents = await appDirectory.getAppIntentsByContext('testContext.NonExistent');

            expect(intents).toEqual([] as AppIntent[]);
        });
    });
    describe('When finding app intents by context with a context implemented by only 1 intent in 1 app', () => {
        beforeEach(() => {
            mockJson.mockResolvedValue(fakeAppDirectory);
        });
        it('Should return 1 intent in 1 app', async () => {
            const intents = await appDirectory.getAppIntentsByContext('testContext.Instrument');

            expect(intents).toEqual([
                {
                    intent: {name: 'testIntent.ShowChart', displayName: 'testIntent.ShowChart'},
                    apps: [fakeApp2]
                }
            ] as AppIntent[]);
        });
    });
});
