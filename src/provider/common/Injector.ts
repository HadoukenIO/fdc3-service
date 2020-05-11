import {Container} from 'inversify';
import {interfaces as inversify} from 'inversify/dts/interfaces/interfaces';
import {DeferredPromise} from 'openfin-service-async';

import {ConfigStore, ConfigStoreBinding} from '../model/ConfigStore';
import {AppDirectory} from '../model/AppDirectory';
import {IntentHandler} from '../controller/IntentHandler';
import {ContextHandler} from '../controller/ContextHandler';
import {Model} from '../model/Model';
import {ResolverHandler, ResolverHandlerBinding} from '../controller/ResolverHandler';
import {AsyncInit} from '../controller/AsyncInit';
import {FinEnvironment} from '../model/FinEnvironment';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {ChannelHandler} from '../controller/ChannelHandler';
import {EventHandler} from '../controller/EventHandler';
import {Environment} from '../model/Environment';

import {Inject} from './Injectables';

/**
 * For each entry in `Inject`, defines the type that will be injected for that key.
 */
interface Types {
    [Inject.API_HANDLER]: APIHandler<APIFromClientTopic>;
    [Inject.APP_DIRECTORY]: AppDirectory;
    [Inject.CHANNEL_HANDLER]: ChannelHandler;
    [Inject.CONFIG_STORE]: ConfigStoreBinding;
    [Inject.CONTEXT_HANDLER]: ContextHandler;
    [Inject.ENVIRONMENT]: Environment;
    [Inject.EVENT_HANDLER]: EventHandler;
    [Inject.INTENT_HANDLER]: IntentHandler;
    [Inject.MODEL]: Model;
    [Inject.RESOLVER]: ResolverHandlerBinding;
}

/**
 * Default injector mappings. Used at startup to initialise injectify.
 *
 * Using a type here will configure injectify to instantiate a class and inject it as a singleton.
 * Using a value here will inject that instance.
 */
const Bindings = {
    [Inject.API_HANDLER]: APIHandler,
    [Inject.APP_DIRECTORY]: AppDirectory,
    [Inject.CHANNEL_HANDLER]: ChannelHandler,
    [Inject.CONFIG_STORE]: ConfigStore,
    [Inject.CONTEXT_HANDLER]: ContextHandler,
    [Inject.ENVIRONMENT]: FinEnvironment,
    [Inject.EVENT_HANDLER]: EventHandler,
    [Inject.INTENT_HANDLER]: IntentHandler,
    [Inject.MODEL]: Model,
    [Inject.RESOLVER]: ResolverHandler
};

type Keys = (keyof typeof Inject & keyof typeof Bindings & keyof Types);

/**
 * Wrapper around inversify that allows more concise injection
 */
export class Injector {
    private static readonly _initialized: DeferredPromise = new DeferredPromise();
    private static _ready: boolean = false;
    private static readonly _container: Container = Injector.createContainer();

    public static async init(): Promise<void> {
        const container: Container = Injector._container;
        const promises: Promise<unknown>[] = [];

        Injector.getKeys().forEach((key) => {
            const proto = (Bindings[key] as Function).prototype;

            if (proto && proto.hasOwnProperty('init')) {
                const instance = (container.get(Inject[key]) as AsyncInit);
                if (instance.delayedInit) {
                    promises.push(instance.delayedInit());
                }
            }
        });

        await Promise.all(promises);
        Injector._ready = true;
        Injector._initialized.resolve();

        return Injector._initialized.promise;
    }

    public static get initialized(): Promise<void> {
        return Injector._initialized.promise;
    }

    public static rebind<K extends Keys>(type: typeof Inject[K]): inversify.BindingToSyntax<Types[K]> {
        return Injector._container.rebind<Types[K]>(type);
    }

    /**
     * Fetches an instance of a pre-defined injectable type/value.
     *
     * The type returned for each token is determined by the `Instances` map.
     *
     * @param type Identifier of the type/value to extract from the injector
     */
    public static get<K extends Keys>(type: typeof Inject[K]): Types[K] {
        if (!Injector._ready) {
            throw new Error('Injector not initialised');
        }
        return Injector._container.get<Types[K]>(type);
    }

    /**
     * Creates a new instance of an injectable type.
     *
     * This class does not need to exist within the `Instances` map, but any values being injected into it must.
     *
     * @param type Any class that is tagged with `@injectable`
     */
    public static getClass<T extends {}>(type: (new (...args: any[])=> T)): T {
        const value = Injector._container.resolve<T>(type);

        return value;
    }

    private static getKeys(): Keys[] {
        return Object.keys(Bindings) as Keys[];
    }

    private static createContainer(): Container {
        const container = new Container();

        Injector.getKeys().forEach((key) => {
            if (typeof Bindings[key] === 'function') {
                container.bind(Inject[key]).to(Bindings[key]).inSingletonScope();
            } else {
                container.bind(Inject[key]).toConstantValue(Bindings[key]);
            }
        });

        return container;
    }
}
