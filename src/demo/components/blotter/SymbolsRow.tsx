import * as React from 'react';
import * as fdc3 from '../../../client/main';
import {IApplication} from '../../../client/directory';
import {Symbol} from '../../apps/BlotterApp';
import {IntentButton} from '../common/IntentButton';
import {showContextMenu, ContextMenuItem, ContextMenuPayload} from '../common/ContextMenu';

import './SymbolsRow.css';

interface SymbolsRowProps {
    item: Symbol;
    chartApps: IApplication[];
    selected?: boolean;
    handleSelect?: (item: Symbol | null) => void;
}

interface Payload {
    intent: string;
    appName?: string;
}

const menuItems: ContextMenuItem<Payload>[] = [
    {
        text: "View Quote",
        payload: {
            intent: fdc3.Intents.VIEW_QUOTE,
        }
    },
    {
        text: "View News",
        payload: {
            intent: fdc3.Intents.VIEW_NEWS,
        }
    },
    {
        text: "View Chart",
        children: []
    }
];

const viewChartsSubMenu: ContextMenuItem = {
    text: "Use Default",
    children: []
};


export function SymbolsRow(props: SymbolsRowProps): React.ReactElement {
    const {item, chartApps, selected, handleSelect} = props;

    React.useEffect(() => {
        const appItems = chartApps.map(app => {
            return {
                text: "View " + app.title,
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

    const chartIntentAction = () => {
        if (handleSelect) {
            handleSelect(null);
        }
        return fdc3.raiseIntent(fdc3.Intents.VIEW_CHART, getContext());
    };

    const getContext = () => {
        return {
            type: "security",
            name: item.name,
            id: {
                default: item.name
            }
        };
    };

    const handleContextMenuSelection = (payload: ContextMenuPayload) => {
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
        <tr className={"symbols-row" + (selected ? " w3-theme-l2" : "")} onClick={handleClick}>
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