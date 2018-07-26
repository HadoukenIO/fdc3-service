import * as React from 'react';

import { IContact } from '../../apps/ContactsApp';
import { ContactsRow } from './ContactsRow';

interface IContactTableProps {
    items?: IContact[];
}

interface IContactTableState {
    selectedItem: IContact;
}

export class ContactsTable extends React.Component<IContactTableProps, IContactTableState> {
    constructor(props: IContactTableProps) {
        super(props);

        this.state = {selectedItem: null};

        this.handleSelect = this.handleSelect.bind(this);
    }

    public render(): JSX.Element {
        return (
            <table className="w3-table-all w3-hoverable">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>E-mail</th>
                        <th>Phone</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {this.props.items.map((item) => <ContactsRow key={item.name} item={item} selected={item == this.state.selectedItem} handleSelect={this.handleSelect} />)}
                </tbody>
            </table>
        );
    }

    private handleSelect(item: IContact): void {
        if (item != this.state.selectedItem) {
            this.setState({selectedItem: item});
        }
    }
}
