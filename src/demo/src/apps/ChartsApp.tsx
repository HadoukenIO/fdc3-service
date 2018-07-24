import * as React from 'react';
import * as fdc3 from '../../../client/index';

import '../../public/css/w3.css';

import { Chart } from '../components/charts/Chart';
import { SecurityPayload, Payload } from '../../../client/context';

interface IAppProps {
    symbolName?: string;
}

interface IAppState {
    symbolName: string;
}

export class ChartsApp extends React.Component<IAppProps, IAppState> {
    constructor(props: IAppState) {
        super(props);

        document.title = "Charts";
        this.state = {
            symbolName: props.symbolName || "AAPL"
        };

        //Add FDC3 listeners
        const chartListener = new fdc3.IntentListener(fdc3.Intents.VIEW_CHART, (context: SecurityPayload): Promise<void> => {
            return new Promise((resolve: ()=>void, reject: (reason?: Error)=>void) => {
                try {
                    this.handleIntent(context);
                    resolve();
                } catch(e) {
                    reject(e);
                }
            });
        });
        const contextListener = new fdc3.ContextListener((context: Payload): void => {
            if (context.type == "security") {
                this.handleIntent(context as SecurityPayload);
            }
        });
    }

    public render(): JSX.Element {
        return (
            <div className="chart-app w3-theme">
                <h1 className="w3-margin-left">{this.state.symbolName}</h1>
                <Chart />
            </div>
        );
    }

    private handleIntent(context: SecurityPayload): void {
        if (context && context.name) {
            this.setState({
                symbolName: context.name
            });
        } else {
            throw new Error("Invalid context received");
        }
    }
}