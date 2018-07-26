import * as React from 'react';

import '../../public/css/w3.css';

import { SymbolsTable } from '../components/blotter/SymbolsTable';

interface IAppState {
    symbols: ISymbol[];
}

export interface ISymbol {
    name: string;
}

export class BlotterApp extends React.Component<{}, IAppState> {
    constructor(props: {}) {
        super(props);

        document.title = "Blotter";

        //Initial set of symbols is hard-coded.
        this.state = {
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
    }

    public render(): JSX.Element {
        return (
            <SymbolsTable items={this.state.symbols} />
        );
    }
}
