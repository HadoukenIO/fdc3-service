import * as React from 'react';

import {NewsCard, NewsItem} from './NewsCard';
import {fetchNews} from './NewsData';

interface NewsFeedProps {
    symbol: string;
}

export function NewsFeed(props: NewsFeedProps): React.ReactElement {
    const {symbol} = props;
    const [isLoading, setLoading] = React.useState(true);
    const [feed, setFeed] = React.useState<NewsItem[]>([]);

    React.useEffect(() => {
        setLoading(true);
        fetchNews(symbol).then(feed => {
            setFeed(feed);
            setLoading(false);
        });
    }, [symbol]);

    return (
        <div className="news-feed">
            {isLoading ? (
                <div className="news-loader">
                    <p>Loading news for {symbol}...</p>
                </div>
            ) : (
                <>
                    <h1>Latest news for {symbol}</h1>
                    <ul>
                        {feed.map((item, i) => (
                            <NewsCard key={i} item={item} />
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
