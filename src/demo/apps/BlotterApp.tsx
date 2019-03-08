import * as React from 'react';

import '../../../res/demo/css/w3.css';

import { SymbolsTable } from '../components/blotter/SymbolsTable';

interface AppState {
    symbols: Symbol[];
}

export interface Symbol {
    name: string;
}

const initialState: AppState = {
    symbols: [
        {"name":"AAPL"},
        {"name":"AMD"},
        {"name":"AMZN"},
        {"name":"CMCSA"},
        {"name":"CSCO"},
        {"name":"FB"},
        {"name":"GOOG"},
        {"name":"INTC"},
        {"name":"MSFT"},
        {"name":"NFLX"},
        {"name":"NVDA"},
        {"name":"PYPL"},
        {"name":"QCOM"},
        {"name":"ROKU"},
        {"name":"TSLA"}
    ]
};

export class BlotterApp extends React.Component<{}, AppState> {
    constructor(props: {}) {
        super(props);
        
        document.title = "Blotter";

        //Initial set of symbols is hard-coded.
        this.state = initialState;
    }

    public render(): JSX.Element {
        return (
            <SymbolsTable items={this.state.symbols} />
        );
    }
}
