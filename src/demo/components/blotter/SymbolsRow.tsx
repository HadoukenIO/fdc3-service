import * as React from 'react';

import * as fdc3 from '../../../client/main';
import {Application} from '../../../client/directory';
import {Symbol} from '../../apps/BlotterApp';
import {IntentButton} from '../common/IntentButton';
import {showContextMenu, ContextMenuItem, ContextMenuPayload} from '../common/ContextMenu';

import './SymbolsRow.css';

interface SymbolsRowProps {
    item: Symbol;
    chartApps: Application[];
    selected?: boolean;
    handleSelect?: (item: Symbol | null) => void;
}

const menuItems: ContextMenuItem[] = [
    {
        text: 'View Quote',
        payload: {
            userData: 'quote'
        }
    },
    {
        text: 'View News',
        payload: {
            userData: 'news'
        }
    },
    {
        text: 'View Chart',
        children: []
    }
];

const defaultViewChart: ContextMenuItem = {
    text: 'Use Default',
    payload: {
        userData: 'charts'
    }
};


export function SymbolsRow(props: SymbolsRowProps): React.ReactElement {
    const {item, chartApps, selected, handleSelect} = props;

    React.useEffect(() => {
        const appItems = chartApps.map(app => {
            return {
                text: "View " + app.name,
                payload: {
                    userData: app.appId
                }
            };
        });
        menuItems[2].children! = [defaultViewChart, ...appItems];
    }, [chartApps]);

    const handleClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (handleSelect) {
            handleSelect(item);
            fdc3.broadcast(getContext());
        }
    };

    const chartIntentAction = () => {
        if (handleSelect) {
            handleSelect(null);
        }
        return fdc3.raiseIntent(fdc3.Intents.VIEW_CHART, getContext());
    };

    const getContext = () => {
        return {
            type: 'security',
            name: item.name,
            id: {
                default: item.name
            }
        };
    };

    const handleContextMenuSelection = (payload: ContextMenuPayload) => {
        // Send intent, "fire and forget" style
        const userData = payload.userData;
        switch (userData) {
            case 'quote':
                fdc3.raiseIntent(fdc3.Intents.VIEW_QUOTE, getContext());
                break;
            case 'news':
                fdc3.raiseIntent(fdc3.Intents.VIEW_NEWS, getContext());
                break;
            case 'chart':
                fdc3.raiseIntent(fdc3.Intents.VIEW_CHART, getContext());
                break;
            default:
                fdc3.raiseIntent(userData, getContext(), userData);
                break;
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
        <tr className={'symbols-row' + (selected ? ' w3-theme-l2' : '')} onClick={handleClick}>
            <td>{item.name}</td>
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
