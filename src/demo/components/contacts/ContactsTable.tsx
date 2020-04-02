import * as React from 'react';

import /* type */ {AppIntent} from '../../../client/main';
import {Contact} from '../../apps/ContactsApp';

import {ContactsRow} from './ContactsRow';

interface ContactTableProps {
    items?: Contact[];
    appIntents: AppIntent[];
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
                    items!.map((item) => <ContactsRow
                        key={item.name}
                        item={item}
                        selected={item === selectedItem}
                        appIntents={props.appIntents}
                        handleSelect={setSelectedItem} />)}
            </tbody>
        </table>
    );
}
