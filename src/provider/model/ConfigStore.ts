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
    private _store: Store<ConfigurationObject>;

    constructor() {
        super();
        this._store = new Store(require('../../../gen/provider/config/defaults.json'));
        new Loader<ConfigurationObject>(this._store, 'fdc3');
    }

    public get config(): Store<ConfigurationObject> {
        return this._store;
    }

    protected async init() {
        const manifest = await fin.Application.getCurrentSync().getManifest();

        if (manifest.config) {
            this._store.add({level: 'desktop'}, manifest.config);
        }
    }
}
