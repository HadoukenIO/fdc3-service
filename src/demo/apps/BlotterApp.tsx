import * as React from 'react';
import '../../../res/demo/css/w3.css';
import {SymbolsTable} from '../components/blotter/SymbolsTable';

export interface Symbol {
    name: string;
}

const symbols: Symbol[] = [
    {"name": "AAPL"},
    {"name": "AMD"},
    {"name": "AMZN"},
    {"name": "CMCSA"},
    {"name": "CSCO"},
    {"name": "FB"},
    {"name": "GOOG"},
    {"name": "INTC"},
    {"name": "MSFT"},
    {"name": "NFLX"},
    {"name": "NVDA"},
    {"name": "PYPL"},
    {"name": "QCOM"},
    {"name": "ROKU"},
    {"name": "TSLA"}
];

export function BlotterApp(): React.ReactElement {
    React.useEffect(() => {
        document.title = "Blotter";
    }, []);

    return (<SymbolsTable items={symbols} />);
}
