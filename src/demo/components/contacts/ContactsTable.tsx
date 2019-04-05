import * as React from 'react';

import {Contact} from '../../apps/ContactsApp';

import {ContactsRow} from './ContactsRow';

interface ContactTableProps {
    items?: Contact[];
}

export function ContactsTable(props: ContactTableProps): React.ReactElement {
    const {items} = props;
    const [selectedItem, setSelectedItem] = React.useState<Contact | null>(null);

    return (
        <table className="w3-table-all w3-hoverable">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>E-mail</th>
                    <th>Phone</th>
                    <th>{}</th>
                </tr>
            </thead>
            <tbody>
                {
                    items!.map((item) => <ContactsRow key={item.name} item={item} selected={item === selectedItem} handleSelect={setSelectedItem} />)}
            </tbody>
        </table>
    );
}
