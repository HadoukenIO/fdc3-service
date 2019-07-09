import * as React from 'react';

import * as fdc3 from '../../client/main';
import {Chart} from '../components/charts/Chart';
import {InstrumentContext, Context} from '../../client/context';
import '../../../res/demo/css/w3.css';
import {ContextChannelSelector} from '../components/ContextChannelSelector/ContextChannelSelector';

interface AppProps {
    symbolName?: string;
}

export function ChartsApp(props: AppProps): React.ReactElement {
    const [symbolName, setSymbolName] = React.useState('AAPL');

    function handleIntent(context: InstrumentContext): void {
        if (context && context.name) {
            setSymbolName(context.name);
        } else {
            throw new Error('Invalid context received');
        }
    }

    React.useEffect(() => {
        document.title = 'Charts';
    }, []);

    React.useEffect(() => {
        const intentListener = fdc3.addIntentListener(fdc3.Intents.VIEW_CHART, (context: Context): Promise<void> => {
            return new Promise((resolve, reject) => {
                try {
                    handleIntent(context as InstrumentContext);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });

        const contextListener = fdc3.addContextListener((context: Context): void => {
            if (context.type === 'security') {
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
                <h1 className="w3-margin-left">{symbolName}</h1>
                <Chart />
            </div>
        </React.Fragment>
    );
}
