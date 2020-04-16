import * as React from 'react';

import /* type */ {Context, InstrumentContext} from '../../client/main';
import {Chart} from '../components/charts/Chart';
import {ContextChannelSelector} from '../components/ContextChannelSelector/ContextChannelSelector';
import {fdc3} from '../stub';

import '../../../res/demo/css/w3.css';

interface AppProps {
    symbolName?: string;
}

export function ChartsApp(props: AppProps): React.ReactElement {
    const [title, setTitle] = React.useState('Apple (AAPL)');

    function handleIntent(context: InstrumentContext): void {
        if (context && context.name) {
            if (context.id.ticker && context.id.ticker !== context.name) {
                setTitle(`${context.name} (${context.id.ticker})`);
            } else {
                setTitle(context.name);
            }
        } else {
            throw new Error('Invalid context received');
        }
    }

    React.useEffect(() => {
        document.title = 'Charts';
    }, []);

    React.useEffect(() => {
        fdc3.getCurrentChannel().then(async (channel) => {
            const context = await channel.getCurrentContext();
            if (context && context.type === 'fdc3.instrument') {
                handleIntent(context as InstrumentContext);
            }
        });
        const intentListener = fdc3.addIntentListener(fdc3.Intents.VIEW_CHART, (context: Context): void => {
            handleIntent(context as InstrumentContext);
        });

        const contextListener = fdc3.addContextListener((context: Context): void => {
            if (context.type === 'fdc3.instrument') {
                handleIntent(context as InstrumentContext);
            }
        });

        return function cleanUp() {
            intentListener.unsubscribe();
            contextListener.unsubscribe();
        };
    }, []);

    return (
        <React.Fragment>
            <ContextChannelSelector float={true} />
            <div className="chart-app w3-theme">
                <h1 className="w3-margin-left">{title}</h1>
                <Chart />
            </div>
        </React.Fragment>
    );
}
