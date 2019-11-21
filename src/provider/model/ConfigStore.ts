import {Store} from 'openfin-service-config';
import {Loader} from 'openfin-service-config/Loader';
import {injectable} from 'inversify';

import {ConfigurationObject} from '../../../gen/provider/config/fdc3-config';
import {AsyncInit} from '../controller/AsyncInit';

export interface ConfigStoreBinding {
    initialized: Promise<void>;
    config: Store<ConfigurationObject>;
}

@injectable()
export class ConfigStore extends AsyncInit implements ConfigStoreBinding {
    private readonly _store: Store<ConfigurationObject>;
    private readonly _loader: Loader<ConfigStoreBinding>;

    constructor() {
        super();
        this._store = new Store(require('../../../gen/provider/config/defaults.json'));
        this._loader = new Loader<ConfigurationObject>(this._store, 'fdc3');
    }

    public get config(): Store<ConfigurationObject> {
        return this._store;
    }

    protected async init() {
        await this._loader.initialized;
    }
}
