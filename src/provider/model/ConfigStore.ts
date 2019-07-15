import {Store} from 'openfin-service-config';
import {Loader} from 'openfin-service-config/Loader';
import {injectable} from 'inversify';

import {ConfigurationObject} from '../../../gen/provider/config/fdc3-config';
import {AsyncInit} from '../controller/AsyncInit';

@injectable()
export class ConfigStore extends AsyncInit {
    private _store: Store<ConfigurationObject>;
    private _loader: Loader<ConfigurationObject>;

    constructor() {
        super();
        this._store = new Store(require('../../../gen/provider/config/defaults.json'));
        this._loader = new Loader(this._store, 'fdc3');
    }

    public get config() {
        return this._store;
    }

    protected async init() {
        const manifest = await fin.Application.getCurrentSync().getManifest();

        if (manifest.config) {
            this._store.add({level: 'desktop'}, manifest.config);
        }
    }
}
