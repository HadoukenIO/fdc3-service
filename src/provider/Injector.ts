import {Container} from "inversify";
import {interfaces as inversify} from "inversify/dts/interfaces/interfaces";
import {Inject} from "./Injectables";
import {AppDirectory} from "./model/AppDirectory";
import {IntentHandler} from "./controller/IntentHandler";
import {ContextHandler} from "./controller/ContextHandler";
import {Model} from "./model/Model";
import {SelectorHandler} from "./controller/SelectorHandler";
import {AsyncInit} from "./controller/AsyncInit";
import {FinEnvironment} from "./model/Environment";
import {Environment} from "openfin/_v2/environment/environment";

interface I {
    foo: string;
    bar: number;
}

/**
 * For each entry in `Inject`, defines the type that will be injected for that key.
 */
type Types = {
    [Inject.APP_DIRECTORY]: AppDirectory,
    [Inject.CONTEXT_HANDLER]: ContextHandler,
    [Inject.ENVIRONMENT]: Environment,
    [Inject.INTENT_HANDLER]: IntentHandler,
    [Inject.INTERFACE]: I,
    [Inject.MODEL]: Model,
    [Inject.SELECTOR]: SelectorHandler
};

/**
 * Default injector mappings. Used at startup to initialise injectify.
 * 
 * Using a type here will configure injectify to instantiate a class and inject it as a singleton.
 * Using a value here will inject that instance.
 */
const Bindings = {
    [Inject.APP_DIRECTORY]: AppDirectory,
    [Inject.CONTEXT_HANDLER]: ContextHandler,
    [Inject.ENVIRONMENT]: FinEnvironment,
    [Inject.INTENT_HANDLER]: IntentHandler,
    [Inject.INTERFACE]: {foo: 'a', bar: 1},
    [Inject.MODEL]: Model,
    [Inject.SELECTOR]: SelectorHandler
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
            const key: keyof typeof Inject = k as any;
            if (typeof Bindings[key] === 'function') {
                // container.bind(Inject[key]).toProvider(Injector.providerCreator.bind(null, key));
                container.bind(Inject[key]).to(Bindings[key] as any).inSingletonScope();
                
                if ((Bindings[key] as Function).prototype.hasOwnProperty('init')) {
                    console.log(key, "is async");
                    promises.push((container.get(Inject[key]) as AsyncInit).initialized);
                }

                /*container.bind(Inject[key]).to(Bindings[key] as any).inSingletonScope();/*.onActivation(async (context, instance) => {
                    if ((Bindings[key] as Function).prototype.hasOwnProperty('init')) {
                        console.log(key, "is async");
                    } else {
                        console.log(key, "is sync");
                    }

                    await new Promise(resolve => setTimeout(resolve, 5000));

                    return instance;
                });*/

                // container.bind(Inject[key]).toProvider((context: inversify.Context) => {
                //     return container.get(Bindings[key] as any);
                // });
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

    /*
    private static providerCreator<T, K extends Keys>(identifier: K, context: inversify.Context): inversify.Provider<T> {
        // return () => {
            return new Promise((resolve, reject) => {
                const value: T&(AsyncInit|{}) = Injector._container.resolve(Bindings[identifier] as inversify.Newable<T&(AsyncInit|{})>);

                if (value.hasOwnProperty('initialized')) {
                    console.log(identifier, "is async");
                    (value as AsyncInit).initialized.then(() => resolve(value));
                } else {
                    console.log(identifier, "is sync");
                    resolve(value);
                }
            }) as any;
        // };
    }
    //*/
}
