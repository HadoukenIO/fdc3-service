import {injectable} from 'inversify';
import {DeferredPromise} from 'openfin-async-utils';

/**
 * Base class for any objects that initialise asynchronously.
 *
 * Since constructors cannot be awaited, this class acts to create a common pattern for these types of objects.
 *
 * To ensure the object is fully initilased before usage, place an `await myObject.initialised;` immediately after
 * construction.
 */
@injectable()
export abstract class AsyncInit {
    private readonly _initialized!: DeferredPromise<void>;

    constructor() {
        this._initialized = new DeferredPromise<void>();
    }

    public get initialized(): Promise<void> {
        return this._initialized.promise;
    }

    /**
     * Triggers the async initialisation of this class. Should only ever be called once, immediately after construction.
     *
     * This is automatically invoked from within the Injector.
     */
    public delayedInit(): Promise<void> {
        this.init().then(() => {
            this._initialized.resolve();
        });

        return this._initialized.promise;
    }

    protected abstract async init(): Promise<void>;
}
