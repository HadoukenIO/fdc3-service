import {Identity} from 'openfin/_v2/main';

import {getServiceIdentityUUID} from '../../client/internal';

export const RESOLVER_IDENTITY: Identity = {
    uuid: getServiceIdentityUUID(),
    name: 'fdc3-resolver'
};
