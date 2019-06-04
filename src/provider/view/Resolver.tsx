import * as React from 'react';
import {render} from 'react-dom';

import {AppList} from './components/AppList';

import '../../../res/provider/ui/resolver/css/resolver.css';
render(<AppList />, document.getElementById('react-app'));
