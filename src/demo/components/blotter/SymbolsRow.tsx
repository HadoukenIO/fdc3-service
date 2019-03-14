import * as React from 'react';
import * as fdc3 from '../../../client/index';
import {IApplication} from '../../../client/directory';
import {Symbol} from '../../apps/BlotterApp';
import {ContextMenu, StaticContextMenuItem, ContextMenuItemType, ContextMenuItem} from '../common/ContextMenu';
import {IntentButton} from '../common/IntentButton';

import './SymbolsRow.css';

interface SymbolsRowProps {
    item: Symbol;
    selected?: boolean;
    handleSelect?: (item: Symbol | null) => void;
}

const menuItems: ContextMenuItem[] = [
    {caption: "View Quote", userData: "quote"},
    {caption: "View News", userData: "news"},
    {
        caption: "View Chart", children: [
            {caption: "Use Default", userData: "chart"},
            {type: ContextMenuItemType.SEPARATOR},
            new Promise<StaticContextMenuItem[]>((resolve, reject) => {
                fdc3.resolve(fdc3.Intents.VIEW_CHART).then((value: IApplication[]) => {
                    resolve(value.map((app: IApplication): StaticContextMenuItem => ({
                        type: ContextMenuItemType.BUTTON,
                        caption: app.title,
                        userData: app.name
                    })));
                }, reject);
            })
        ] as ContextMenuItem[]
    }
];

export const SymbolsRow: React.FunctionComponent<SymbolsRowProps> = (props) => {
    const {item, selected, handleSelect} = props;
    const handleClick = (event: React.MouseEvent<HTMLTableRowElement>) => {
        event.preventDefault();
        if (handleSelect) {
            handleSelect(item);
            fdc3.broadcast(getContext());
        }
    };

    const chartIntentAction = () => {
        if (handleSelect) {
            handleSelect(null);
        }
        return new fdc3.Intent(fdc3.Intents.VIEW_CHART, getContext()).send();
    };

    const handleContextMenuSelection = (type: ContextMenuItemType, userData: string) => {
        let intent: fdc3.Intent | null = null;
        switch (userData) {
            case "quote":
                intent = new fdc3.Intent(fdc3.Intents.VIEW_QUOTE, getContext());
                break;
            case "news":
                intent = new fdc3.Intent(fdc3.Intents.VIEW_NEWS, getContext());
                break;
            case "chart":
                intent = new fdc3.Intent(fdc3.Intents.VIEW_CHART, getContext());
                break;
            default:
                intent = new fdc3.Intent(fdc3.Intents.VIEW_CHART, getContext(), userData);
                break;
        }
        //Send intent, "fire and forget" style
        intent.send();
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

    return (
        <tr className={"symbols-row" + (selected ? " w3-theme-l2" : "")} onClick={handleClick}>
            <td>{item.name}</td>
            <td>##.##</td>
            <td>##.##</td>
            <td>##.##</td>
            <td>##.##</td>
            <td>
                <IntentButton action={chartIntentAction} title="View Chart" iconClassName="fa-line-chart" />
                <ContextMenu items={menuItems} handleSelection={handleContextMenuSelection}>
                    <button>
                        <i className="fa fa-ellipsis-v" title="Options" />
                    </button>
                </ContextMenu>
            </td>
        </tr>
    );
};