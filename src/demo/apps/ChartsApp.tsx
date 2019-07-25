import * as React from 'react';

import * as fdc3 from '../../client/main';
import {Chart} from '../components/charts/Chart';
import {SecurityContext, Context} from '../../client/context';
import '../../../res/demo/css/w3.css';
import {ContextChannelSelector} from '../components/ContextChannelSelector/ContextChannelSelector';
import {getCurrentChannel} from '../../client/main';

interface AppProps {
    symbolName?: string;
}

export function ChartsApp(props: AppProps): React.ReactElement {
    const [symbolName, setSymbolName] = React.useState('AAPL');

    function handleIntent(context: SecurityContext): void {
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
        getCurrentChannel().then(async channel => {
            const context = await channel.getCurrentContext();
            if (context && context.type === 'security')
                handleIntent(context as SecurityContext);
        });
        const intentListener = fdc3.addIntentListener(fdc3.Intents.VIEW_CHART, (context: Context): Promise<void> => {
            return new Promise((resolve, reject) => {
                try {
                    handleIntent(context as SecurityContext);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });

        const contextListener = fdc3.addContextListener((context: Context): void => {
            if (context.type === 'security') {
                handleIntent(context as SecurityContext);
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
