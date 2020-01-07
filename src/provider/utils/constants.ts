import {Identity} from 'openfin/_v2/main';

import {getServiceIdentity} from '../../client/internal';

export const RESOLVER_IDENTITY: Identity = {
    uuid: getServiceIdentity().uuid,
    name: 'fdc3-resolver'
};
