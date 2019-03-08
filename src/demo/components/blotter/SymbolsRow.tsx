import * as React from 'react';
import * as fdc3 from '../../../client/index';
import { SecurityPayload } from '../../../client/context';
import { IApplication } from '../../../client/directory';
import { Symbol } from '../../apps/BlotterApp';
import { ContextMenu, StaticContextMenuItem, ContextMenuItemType, ContextMenuItem } from '../common/ContextMenu';

import './SymbolsRow.css';

interface SymbolsRowProps {
    item?: Symbol;
    selected?: boolean;
    handleSelect?: (item: Symbol|null) => void;
}

export class SymbolsRow extends React.Component<SymbolsRowProps> {
    constructor(props: SymbolsRowProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleChart = this.handleChart.bind(this);
        this.handleContextSelection = this.handleContextSelection.bind(this);
    }

    public render(): JSX.Element {
        const item: Symbol = this.props.item!;

        const menuItems: ContextMenuItem[] = [
            {caption: "View Quote", userData: "quote"},
            {caption: "View News", userData: "news"},
            {caption: "View Chart", children: [
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
            ] as ContextMenuItem[]}
        ];

        return (
            <tr className={"symbols-row" + (this.props.selected ? " w3-theme-l2" : "")} onClick={this.handleClick}>
                <td>{item.name}</td>
                <td>##.##</td>
                <td>##.##</td>
                <td>##.##</td>
                <td>##.##</td>
                <td>
                    <button onClick={this.handleChart}>
                        <i className="fa fa-line-chart" title="View Chart" />
                    </button>
                    <ContextMenu items={menuItems} handleSelection={this.handleContextSelection}>
                        <button>
                            <i className="fa fa-ellipsis-v" title="Options" />
                        </button>
                    </ContextMenu>
                </td>
            </tr>
        );
    }

    private handleClick(event: React.MouseEvent<HTMLTableRowElement>): void {
        const handler: (item: Symbol)=>void = this.props.handleSelect!;

        if (handler) {
            handler(this.props.item!);

            //Update the context of any apps that understand 'symbol' objects
            fdc3.broadcast(this.getContext());
        }
    }

    private handleChart(event: React.MouseEvent<HTMLButtonElement>): void {
        const button: HTMLButtonElement = event.currentTarget,
            icon: Element = button.firstElementChild!,
            iconClass: string = "fa fa-line-chart";

        let intent: fdc3.Intent;

        //Create the appropriate intent
        intent = new fdc3.Intent(fdc3.Intents.VIEW_CHART, this.getContext());

        //Convert icon to spinner whilst we are waiting for the intent
        icon.className = "fa fa-spinner fa-spin";

        //Send intent, and revert button state once resolved/rejected
        intent.send().then(() => {
            //Revert icon to it's initial state
            button.className = "";
            icon.className = iconClass;
        }, (reason: Error) => {
            //Revert icon to it's initial state, with error indicator
            button.className = "w3-red";
            icon.className = iconClass;
            
            alert("Intent failed with message '" + reason.message + "'");
        });

        //Clear table row selection
        event.stopPropagation();
        if(this.props.handleSelect){
            this.props.handleSelect(null);
        }
    }

    private handleContextSelection(type: ContextMenuItemType, userData: string): void {
        let intent: fdc3.Intent|null = null;

        //Create an intent of the requested type
        switch(userData) {
            case "quote":
                intent = new fdc3.Intent(fdc3.Intents.VIEW_QUOTE, this.getContext());
                break;
            case "news":
                intent = new fdc3.Intent(fdc3.Intents.VIEW_NEWS, this.getContext());
                break;
            case "chart":
                intent = new fdc3.Intent(fdc3.Intents.VIEW_CHART, this.getContext());
                break;
            default:
                intent = new fdc3.Intent(fdc3.Intents.VIEW_CHART, this.getContext(), userData);
                break;
        }

        //Send intent, "fire and forget" style
        intent.send();
    }

    private getContext(): SecurityPayload {
        const item: Symbol = this.props.item!;

        return {
            type: "security",
            name: item.name,
            id: {
                default: item.name
            }
        };
    }
}
