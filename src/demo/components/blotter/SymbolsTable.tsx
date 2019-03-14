import * as React from 'react';

import {Symbol} from '../../apps/BlotterApp';
import {SymbolsRow} from './SymbolsRow';

interface SymbolsTableProps {
    items?: Symbol[];
}


export function SymbolsTable(props: SymbolsTableProps): React.ReactElement {
    const {items} = props;
    const [selectedItem, setSelectedItem] = React.useState<Symbol | null>(items![0] || null);
    const handleSelect = (item: Symbol | null) => {
        setSelectedItem(item);
    };

    return (
        <table className="w3-table-all w3-hoverable">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Bid Size</th>
                    <th>Bid Price</th>
                    <th>Ask Size</th>
                    <th>Ask Price</th>
                    <th>{}</th>
                </tr>
            </thead>
            <tbody>
                {items && items.map((item) => <SymbolsRow key={item.name} item={item} selected={item === selectedItem} handleSelect={handleSelect} />)}
            </tbody>
        </table>
    );
}
