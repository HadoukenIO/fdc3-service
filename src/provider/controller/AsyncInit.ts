import {injectable} from 'inversify';

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
    private _initialized: Promise<this>;

    constructor() {
        this._initialized = this.init().then(() => this);
    }

    public get initialized(): Promise<this> {
        return this._initialized;
    }

    protected abstract async init(): Promise<void>;
}
