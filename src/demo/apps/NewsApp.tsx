import * as React from 'react';

import * as fdc3 from '../../client/main';
import {NewsFeed} from '../components/news/NewsFeed';
import {InstrumentContext, Context} from '../../client/context';
import '../../../res/demo/css/w3.css';
import {ContextChannelSelector} from '../components/ContextChannelSelector/ContextChannelSelector';
import {getCurrentChannel} from '../../client/main';

export function NewsApp(): React.ReactElement {
    const [symbolName, setSymbolName] = React.useState('Apple Inc (AAPL)');

    function handleIntent(context: InstrumentContext): void {
        if (context && context.name) {
            if (context.id.ticker && context.id.ticker !== context.name) {
                setSymbolName(`${context.name} (${context.id.ticker})`);
            } else {
                setSymbolName(context.name);
            }
        } else {
            throw new Error('Invalid context received');
        }
    }

    React.useEffect(() => {
        document.title = `News for: ${symbolName}`;
    }, [symbolName]);

    React.useEffect(() => {
        getCurrentChannel().then(async channel => {
            const context = await channel.getCurrentContext();
            if (context && context.type === 'fdc3.instrument') {
                handleIntent(context as InstrumentContext);
            }
        });

        const intentListener = fdc3.addIntentListener(fdc3.Intents.VIEW_NEWS, (context: Context): Promise<void> => {
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
            <div className="news-app">
                <NewsFeed symbol={symbolName} />
            </div>
        </React.Fragment>
    );
}
