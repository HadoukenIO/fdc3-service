import {NewsItem} from './NewsCard';

export function fetchNews(symbol: string) {
    return new Promise<NewsItem[]>(resolve => {
        setTimeout(() => {
            resolve([symbol, symbol, symbol].map(getFakeNews).sort(byDate));
        }, 100 + Math.random() * 500);
    });
}

function getFakeNews(symbol: string): NewsItem {
    return {
        date: getRandomDate(),
        headline: getRandomHeadline(symbol)
    };
}

function getRandomDate() {
    return new Date(new Date().valueOf() - Math.random() * 1e9);
}

function getRandomHeadline(symbol: string) {
    return `This is a fake news article for ${symbol}`;
}

function byDate(a: NewsItem, b: NewsItem) {
    return b.date.valueOf() - a.date.valueOf();
}
