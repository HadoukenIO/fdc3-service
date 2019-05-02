import * as React from 'react';

import {SymbolsTable} from '../components/blotter/SymbolsTable';
import '../../../res/demo/css/w3.css';
import {ContextChannelSelector} from '../components/ContextChannelSelector/ContextChannelSelector';

export interface Symbol {
    name: string;
}

const symbols: Symbol[] = [
    {'name': 'AAPL'},
    {'name': 'AMD'},
    {'name': 'AMZN'},
    {'name': 'CMCSA'},
    {'name': 'CSCO'},
    {'name': 'FB'},
    {'name': 'GOOG'},
    {'name': 'INTC'},
    {'name': 'MSFT'},
    {'name': 'NFLX'},
    {'name': 'NVDA'},
    {'name': 'PYPL'},
    {'name': 'QCOM'},
    {'name': 'ROKU'},
    {'name': 'TSLA'}
];

export function BlotterApp(): React.ReactElement {
    React.useEffect(() => {
        document.title = 'Blotter';
    }, []);

    return (
        <React.Fragment>
            <ContextChannelSelector />
            <SymbolsTable items={symbols} />
        </React.Fragment>
    );
}
