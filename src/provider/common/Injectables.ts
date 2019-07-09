/**
 * Declare all injectable types/values here.
 *
 * This enum determines the keys that can be used within `@inject` tags. The mapping of these tags to default concrete types is defined in
 * `Injector.ts`. These mappings can be programmatically overridden by calling the methods of the {@link Injector} util.
 */
enum Injectable {
    API_HANDLER,
    APP_DIRECTORY,
    CHANNEL_HANDLER,
    CONTEXT_HANDLER,
    ENVIRONMENT,
    INTENT_HANDLER,
    EVENT_HANDLER,
    MODEL,
    RESOLVER,
    CONFIG_STORE
}

type InjectableMap = {
    [K in keyof typeof Injectable]: K extends string ? K : never;
}

/**
 * Create exported symbol map.
 *
 * These are used as the keys that control what will get injected into class members.
 */
export const Inject: InjectableMap = Object.keys(Injectable).filter(k => typeof k === 'string').reduce<InjectableMap>((map, item) => {
    (map as any)[item] = item;
    return map;
}, {} as InjectableMap);
