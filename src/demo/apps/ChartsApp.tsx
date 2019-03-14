import * as React from 'react';
import * as fdc3 from '../../client/index';
import {Chart} from '../components/charts/Chart';
import {SecurityPayload, Payload} from '../../client/context';

import '../../../res/demo/css/w3.css';

interface AppProps {
    symbolName?: string;
}

export const ChartsApp: React.FunctionComponent<AppProps> = (props) => {
    const [symbolName, setSymbolName] = React.useState("AAPL");

    function handleIntent(context: SecurityPayload): void {
        if (context && context.name) {
            setSymbolName(context.name);
        } else {
            throw new Error("Invalid context received");
        }
    }

    React.useEffect(() => {
        document.title = "Charts";
    });

    React.useEffect(() => {
        const intent = new fdc3.IntentListener(fdc3.Intents.VIEW_CHART, (context: Payload): Promise<void> => {
            return new Promise((resolve, reject) => {
                try {
                    handleIntent(context as SecurityPayload);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });

        const context = new fdc3.ContextListener((context: Payload): void => {
            if (context.type === "security") {
                handleIntent(context as SecurityPayload);
            }
        });

        return function cleanUp() {
            intent.unsubscribe();
            context.unsubscribe();
        };
    }, []);


    return (
        <div className="chart-app w3-theme">
            <h1 className="w3-margin-left">{symbolName}</h1>
            <Chart />
        </div>
    );
};