import * as React from 'react';

import * as fdc3 from '../../client/main';
import {NewsFeed} from '../components/news/NewsFeed';
import {SecurityContext, Context} from '../../client/context';
import '../../../res/demo/css/w3.css';
import {ContextChannelSelector} from '../components/ContextChannelSelector/ContextChannelSelector';
import {getCurrentChannel} from '../../client/main';

export function NewsApp(): React.ReactElement {
    const [symbolName, setSymbolName] = React.useState('AAPL');

    function handleIntent(context: SecurityContext): void {
        if (context && context.name) {
            setSymbolName(context.name);
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
            if (context && context.type === 'security') {
                handleIntent(context as SecurityContext);
            }
        });

        const intentListener = fdc3.addIntentListener(fdc3.Intents.VIEW_NEWS, (context: Context): Promise<void> => {
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
            if (context.type === 'fdc3.security') {
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
            <div className="news-app">
                <NewsFeed symbol={symbolName} />
            </div>
        </React.Fragment>
    );
}
