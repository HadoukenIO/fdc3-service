import * as React from 'react';

import /* type */ {Application, AppName} from '../../../client/directory';
import {Instrument} from '../../apps/BlotterApp';
import {IntentButton} from '../common/IntentButton';
import {showContextMenu, ContextMenuItem} from '../common/ContextMenu';
import {fdc3} from '../../stub';

import './SymbolsRow.css';

interface SymbolsRowProps {
    item: Instrument;
    chartApps: Application[];
    selected?: boolean;
    handleSelect?: (item: Instrument | null) => void;
}

interface Payload {
    intent: string;
    appName?: AppName;
}

const menuItems: ContextMenuItem<Payload>[] = [
    {
        text: 'View Quote',
        payload: {
            intent: 'ViewQuote' // fdc3.Intents.VIEW_QUOTE
        }
    },
    {
        text: 'View News',
        payload: {
            intent: 'ViewNews' // fdc3.Intents.VIEW_NEWS
        }
    },
    {
        text: 'View Chart',
        children: []
    }
];

const viewChartsSubMenu: ContextMenuItem = {
    text: 'Use Default',
    payload: {
        intent: 'ViewChart' // fdc3.Intents.VIEW_CHART
    }
};

export function SymbolsRow(props: SymbolsRowProps): React.ReactElement {
    const {item, chartApps, selected, handleSelect} = props;

    React.useEffect(() => {
        const appItems = chartApps.map((app) => {
            return {
                text: `View ${app.title}`,
                payload: {
                    intent: fdc3.Intents.VIEW_CHART,
                    appName: app.name
                }
            };
        });
        menuItems[2].children = [viewChartsSubMenu, ...appItems];
    }, [chartApps]);

    const handleClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (handleSelect) {
            handleSelect(item);
            fdc3.broadcast(getContext());
        }
    };

    const chartIntentAction = async () => {
        if (handleSelect) {
            handleSelect(null);
        }
        await fdc3.raiseIntent(fdc3.Intents.VIEW_CHART, getContext());
    };

    const getContext = () => {
        return {
            type: 'fdc3.instrument',
            name: item.name,
            id: {
                ticker: item.ticker
            }
        };
    };

    const handleContextMenuSelection = (payload: Payload) => {
        if (payload.intent) {
            fdc3.raiseIntent(payload.intent, getContext(), payload.appName);
        }
    };

    const handleContextClick = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const offset = {x: 10, y: -10};
        const position = {x: event.screenX + offset.x, y: event.screenY + offset.y};
        showContextMenu(position, menuItems, handleContextMenuSelection);
    };

    return (
        <tr className={`symbols-row${selected ? ' w3-theme-l2' : ''}`} onClick={handleClick}>
            <td><span title={item.ticker}>{item.name}</span></td>
            <td>##.##</td>
            <td>##.##</td>
            <td>##.##</td>
            <td>##.##</td>
            <td>
                <IntentButton action={chartIntentAction} title="View Chart" iconClassName="fa-line-chart" />
                <button onClick={handleContextClick}>
                    <i className="fa fa-ellipsis-v" title="Options" />
                </button>
            </td>
        </tr>
    );
}
