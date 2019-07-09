import {Container} from 'inversify';
import {interfaces as inversify} from 'inversify/dts/interfaces/interfaces';
import {Environment} from 'openfin/_v2/environment/environment';

import {ConfigStore} from '../model/ConfigStore';
import {AppDirectory} from '../model/AppDirectory';
import {IntentHandler} from '../controller/IntentHandler';
import {ContextHandler} from '../controller/ContextHandler';
import {Model} from '../model/Model';
import {ResolverHandler} from '../controller/ResolverHandler';
import {AsyncInit} from '../controller/AsyncInit';
import {FinEnvironment} from '../model/FinEnvironment';
import {APIHandler} from '../APIHandler';
import {APIFromClientTopic} from '../../client/internal';
import {ChannelHandler} from '../controller/ChannelHandler';
import {EventHandler} from '../controller/EventHandler';

import {Inject} from './Injectables';

/**
 * For each entry in `Inject`, defines the type that will be injected for that key.
 */
type Types = {
    [Inject.API_HANDLER]: APIHandler<APIFromClientTopic>,
    [Inject.APP_DIRECTORY]: AppDirectory,
    [Inject.CHANNEL_HANDLER]: ChannelHandler,
    [Inject.CONTEXT_HANDLER]: ContextHandler,
    [Inject.ENVIRONMENT]: Environment,
    [Inject.INTENT_HANDLER]: IntentHandler,
    [Inject.EVENT_HANDLER]: EventHandler,
    [Inject.MODEL]: Model,
    [Inject.RESOLVER]: ResolverHandler,
    [Inject.CONFIG_STORE]: ConfigStore
};

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
    [Inject.CONTEXT_HANDLER]: ContextHandler,
    [Inject.ENVIRONMENT]: FinEnvironment,
    [Inject.INTENT_HANDLER]: IntentHandler,
    [Inject.EVENT_HANDLER]: EventHandler,
    [Inject.MODEL]: Model,
    [Inject.RESOLVER]: ResolverHandler,
    [Inject.CONFIG_STORE]: ConfigStore
};

type Keys = (keyof typeof Inject & keyof typeof Bindings & keyof Types);

/**
 * Wrapper around inversify that allows more concise injection
 */
export class Injector {
    private static _initialized: Promise<void>;

    private static _container: Container = (() => {
        const container = new Container();
        const promises: Promise<unknown>[] = [];

        Object.keys(Bindings).forEach(k => {
            const key: Keys = k as any;

            if (typeof Bindings[key] === 'function') {
                container.bind(Inject[key]).to(Bindings[key] as any).inSingletonScope();

                if ((Bindings[key] as Function).prototype.hasOwnProperty('init')) {
                    promises.push((container.get(Inject[key]) as AsyncInit).initialized);
                }
            } else {
                container.bind(Inject[key]).toConstantValue(Bindings[key]);
            }
        });

        Injector._initialized = Promise.all(promises).then(() => {});
        return container;
    })();

    public static get initialized(): Promise<void> {
        return this._initialized;
    }

    public static rebind<K extends Keys>(type: typeof Inject[K]): inversify.BindingToSyntax<Types[K]> {
        return Injector._container.rebind<Types[K]>(Bindings[type] as inversify.Newable<Types[K]>);
    }

    /**
     * Fetches an instance of a pre-defined injectable type/value.
     *
     * The type returned for each token is determined by the `Instances` map.
     *
     * @param type Identifier of the type/value to extract from the injector
     */
    public static get<K extends Keys>(type: typeof Inject[K]): Types[K] {
        return Injector._container.get<Types[K]>(type);
    }

    /**
     * Creates a new instance of an injectable type.
     *
     * This class does not need to exist within the `Instances` map, but any values being injected into it must.
     *
     * @param type Any class that is tagged with `@injectable`
     */
    public static getClass<T extends {}>(type: (new (...args: any[]) => T)): T {
        const value = Injector._container.resolve<T>(type);

        return value;
    }
}
