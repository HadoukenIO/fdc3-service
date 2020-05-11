import * as React from 'react';

import /* type */ {InstrumentContext, Context} from '../../client/context';
import {NewsFeed} from '../components/news/NewsFeed';
import {ContextChannelSelector} from '../components/ContextChannelSelector/ContextChannelSelector';
import {fdc3} from '../stub';

import '../../../res/demo/css/w3.css';

export function NewsApp(): React.ReactElement {
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
        document.title = `News for: ${title}`;
    }, [title]);

    React.useEffect(() => {
        fdc3.getCurrentChannel().then(async (channel) => {
            const context = await channel.getCurrentContext();
            if (context && context.type === 'fdc3.instrument') {
                handleIntent(context as InstrumentContext);
            }
        });

        const intentListener = fdc3.addIntentListener(fdc3.Intents.VIEW_NEWS, (context: Context): void => {
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
            <div className="news-app">
                <NewsFeed symbol={title} />
            </div>
        </React.Fragment>
    );
}
