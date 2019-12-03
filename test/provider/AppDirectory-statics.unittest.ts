import 'jest';
import 'reflect-metadata';

import {AppDirectory} from '../../src/provider/model/AppDirectory';
import {createFakeApp, createFakeIntent, createFakeContextType} from '../demo/utils/fakes';

describe('When querying individual applications', () => {
    describe('When an app has an intent with no contexts', () => {
        const intent = createFakeIntent();

        const intentType = intent.name;

        const app = createFakeApp({
            intents: [intent]
        });

        it('The app might support that intent', () => {
            expect(AppDirectory.mightAppSupportIntent(app, intentType)).toBe(true);
        });

        it('The app might support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.mightAppSupportIntent(app, arbitraryIntentType)).toBe(true);
        });

        it('The app might support that intent with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            expect(AppDirectory.mightAppSupportIntent(app, intentType, arbitraryContextType)).toBe(true);
        });

        it('The app is expected to support that intent', () => {
            expect(AppDirectory.shouldAppSupportIntent(app, intentType)).toBe(true);
        });

        it('The app is not expected to support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.shouldAppSupportIntent(app, arbitraryIntentType)).toBe(false);
        });

        it('The app is expected to support that intent with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            expect(AppDirectory.shouldAppSupportIntent(app, intentType, arbitraryContextType)).toBe(true);
        });
    });

    describe('When an app has an intent with multiple contexts', () => {
        const contexts = [createFakeContextType(), createFakeContextType(), createFakeContextType()];

        const intent = createFakeIntent({
            contexts
        });

        const intentType = intent.name;

        const app = createFakeApp({
            intents: [intent]
        });

        it('The app might support that intent', () => {
            expect(AppDirectory.mightAppSupportIntent(app, intentType)).toBe(true);
        });

        it('The app might support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.mightAppSupportIntent(app, arbitraryIntentType)).toBe(true);
        });

        it('The app might support that intent with each of its contexts', () => {
            for (const context of contexts) {
                expect(AppDirectory.mightAppSupportIntent(app, intentType, context)).toBe(true);
            }
        });

        it('The app will not support that intent with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            expect(AppDirectory.mightAppSupportIntent(app, intentType, arbitraryContextType)).toBe(false);
        });

        it('The app is expected to support that intent', () => {
            expect(AppDirectory.shouldAppSupportIntent(app, intentType)).toBe(true);
        });

        it('The app is not expected to support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.shouldAppSupportIntent(app, arbitraryIntentType)).toBe(false);
        });

        it('The app is expected to support that intent with each of its contexts', () => {
            for (const context of contexts) {
                expect(AppDirectory.shouldAppSupportIntent(app, intentType, context)).toBe(true);
            }
        });

        it('The app is not expect to support that intent with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            expect(AppDirectory.mightAppSupportIntent(app, intentType, arbitraryContextType)).toBe(false);
        });
    });

    describe('When an app has multiple intents', () => {
        const intent1Contexts = [createFakeContextType(), createFakeContextType(), createFakeContextType()];

        const intent1 = createFakeIntent({
            contexts: intent1Contexts
        });

        const intent2Contexts = [createFakeContextType()];

        const intent2 = createFakeIntent({
            contexts: intent2Contexts
        });

        const intent3 = createFakeIntent({
            contexts: []
        });

        const intent4 = createFakeIntent();

        const intents = [intent1, intent2, intent3, intent4];

        const app = createFakeApp({
            intents
        });

        it('The app might support each of its intents', () => {
            for (const intent of intents) {
                expect(AppDirectory.mightAppSupportIntent(app, intent.name)).toBe(true);
            }
        });

        it('The app might support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.mightAppSupportIntent(app, arbitraryIntentType)).toBe(true);
        });

        it('The app might support each intent with each of its contexts', () => {
            for (const intent of intents) {
                for (const context of intent.contexts || []) {
                    expect(AppDirectory.mightAppSupportIntent(app, intent.name, context)).toBe(true);
                }
            }
        });

        it('For intents with no contexts, the app might support those intents with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            for (const intent of [intent3, intent4]) {
                expect(AppDirectory.mightAppSupportIntent(app, intent.name, arbitraryContextType)).toBe(true);
            }
        });

        it('For intents with contexts, the app will not support those intents with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            for (const intent of [intent1, intent2]) {
                expect(AppDirectory.mightAppSupportIntent(app, intent.name, arbitraryContextType)).toBe(false);
            }
        });

        it('The app is expected to support each of its intents', () => {
            for (const intent of intents) {
                expect(AppDirectory.shouldAppSupportIntent(app, intent.name)).toBe(true);
            }
        });

        it('The app is not expected to support an arbitrary intent', () => {
            const arbitraryIntentType = createFakeIntent().name;

            expect(AppDirectory.shouldAppSupportIntent(app, arbitraryIntentType)).toBe(false);
        });

        it('For intents with contexts, the app is expected to support each of those intents with each intent\'s contexts', () => {
            for (const intent of intents) {
                for (const context of intent.contexts || []) {
                    expect(AppDirectory.shouldAppSupportIntent(app, intent.name, context)).toBe(true);
                }
            }
        });

        it('For intents with contexts, the app is not expected to support each of those intents with contexts of a different intent', () => {
            expect(AppDirectory.shouldAppSupportIntent(app, intent1.name, intent2Contexts[0])).toBe(false);
            expect(AppDirectory.shouldAppSupportIntent(app, intent2.name, intent1Contexts[0])).toBe(false);
        });

        it('For intents with no contexts, the app is expected to support each of those intents with an arbitrary context', () => {
            const arbitraryContextType = createFakeContextType();

            for (const intent of [intent3, intent4]) {
                expect(AppDirectory.shouldAppSupportIntent(app, intent.name, arbitraryContextType)).toBe(true);
            }
        });
    });
});
