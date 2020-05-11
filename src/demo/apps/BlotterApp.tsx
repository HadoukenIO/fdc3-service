import * as React from 'react';

import {SymbolsTable} from '../components/blotter/SymbolsTable';
import '../../../res/demo/css/w3.css';
import {ContextChannelSelector} from '../components/ContextChannelSelector/ContextChannelSelector';

export interface Instrument {
    name: string;
    ticker: string;
}

const symbols: Instrument[] = [
    {ticker: 'AAPL', name: 'Apple'},
    {ticker: 'AMD', name: 'Advanced Micro Devices'},
    {ticker: 'AMZN', name: 'Amazon.com'},
    {ticker: 'CMCSA', name: 'Comcast Corporation'},
    {ticker: 'CSCO', name: 'Cisco Systems'},
    {ticker: 'FB', name: 'Facebook'},
    {ticker: 'GOOG', name: 'Google'},
    {ticker: 'INTC', name: 'Intel Corporation'},
    {ticker: 'MSFT', name: 'Microsoft'},
    {ticker: 'NFLX', name: 'Netflix'},
    {ticker: 'NVDA', name: 'NVIDIA Corporation'},
    {ticker: 'PYPL', name: 'PayPal Holdings'},
    {ticker: 'QCOM', name: 'QUALCOMM'},
    {ticker: 'ROKU', name: 'Roku'},
    {ticker: 'TSLA', name: 'Tesla'}
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
