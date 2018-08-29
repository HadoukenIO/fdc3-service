import * as React from 'react';
import * as fdc3 from '../../../../client/index';
import { ContactPayload } from '../../../../client/context';

import './ContactsRow.css';

import { IContact } from '../../apps/ContactsApp';

interface IContactRowProps {
    item?: IContact;
    selected?: boolean;
    handleSelect?: (item: IContact) => void;
}

export class ContactsRow extends React.Component<IContactRowProps> {
    constructor(props: IContactRowProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
        this.handleDial = this.handleDial.bind(this);
        this.handleCall = this.handleCall.bind(this);
    }

    public render(): JSX.Element {
        var item: IContact = this.props.item;

        return (
            <tr className={"contacts-row" + (this.props.selected ? " w3-theme-l2" : "")} onClick={this.handleClick}>
                <td>{item.name}</td>
                <td>{item.email || ""}</td>
                <td>{item.phone || ""}</td>
                <td>
                    <button onClick={this.handleDial}><i className="fa fa-tty" title="Dial"></i></button>
                    <button onClick={this.handleCall}><i className="fa fa-phone" title="Call"></i></button>
                </td>
            </tr>
        );
    }

    private handleClick(event: React.MouseEvent<HTMLTableRowElement>): void {
        const handler: (item: IContact)=>void = this.props.handleSelect;

        if (handler) {
            handler(this.props.item);

            //Update the context of any apps that understand 'contact' objects
            fdc3.broadcast(this.getContext());
        }
    }

    private handleDial(event: React.MouseEvent<HTMLButtonElement>): void {
        this.sendIntent(event.currentTarget, false);

        event.stopPropagation();
        this.props.handleSelect && this.props.handleSelect(null);
    }

    private handleCall(event: React.MouseEvent<HTMLButtonElement>): void {
        this.sendIntent(event.currentTarget, true);

        event.stopPropagation();
        this.props.handleSelect && this.props.handleSelect(null);
    }

    private getContext(): ContactPayload {
        let item: IContact = this.props.item;

        return {
            type: "contact",
            name: item.name,
            id: {
                email: item.email,
                phone: item.phone
            }
        };
    }

    private sendIntent(button: HTMLButtonElement, startCall: boolean): void {
        var icon: Element = button.firstElementChild,
            iconClass: string = startCall ? "fa fa-phone" : "fa fa-tty",
            intent: fdc3.Intent;

        //Create the appropriate intent
        intent = new fdc3.Intent(startCall ? fdc3.Intents.START_CALL : fdc3.Intents.DIAL_CALL, this.getContext());

        //Convert icon to spinner whilst we are waiting for the intent
        icon.className = "fa fa-spinner fa-spin";

        //Send intent and wait for it to resolve
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
    }
}
