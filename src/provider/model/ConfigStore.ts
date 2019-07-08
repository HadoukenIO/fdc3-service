import {Store} from 'openfin-service-config';
import {Loader} from 'openfin-service-config/Loader';

import {ConfigurationObject} from '../../../gen/provider/config/fdc3-config';

export class ConfigStore extends Store<ConfigurationObject> {
    private loader: Loader<ConfigurationObject>;

    constructor() {
        super(require('../../../gen/provider/config/defaults.json'));
        this.loader = new Loader(this, 'fdc3');
        fin.Application.getCurrentSync().getManifest().then(manifest => {
            if (manifest.config) {
                this.add({level: 'desktop'}, manifest.config);
            }
        });
    }
}
