import * as React from 'react';

import './NewsFeed.css';

export interface NewsItem {
    date: Date;
    headline: string;
}

export function NewsCard({item}: {item: NewsItem}) {
    const {date, headline} = item;

    return (
        <li className="news-item w3-card">
            <div className="news-item__date">
                <span className="news-item__date__date">{date.toDateString()}</span>
                <span className="news-item__date__time">{date.toLocaleTimeString()}</span>
            </div>
            <div className="news-item__headline">
                {headline}
            </div>
        </li>
    );
}
