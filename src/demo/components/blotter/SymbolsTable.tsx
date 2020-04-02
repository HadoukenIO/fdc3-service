import * as React from 'react';

import {Instrument} from '../../apps/BlotterApp';
import /* type */ {Application} from '../../../client/main';
import {fdc3} from '../../stub';

import {SymbolsRow} from './SymbolsRow';

interface SymbolsTableProps {
    items?: Instrument[];
}

async function loadCharts() {
    return fdc3.findIntent(fdc3.Intents.VIEW_CHART);
}

export function SymbolsTable(props: SymbolsTableProps): React.ReactElement {
    const {items} = props;
    const [chartApps, setChartApps] = React.useState<Application[]>([]);
    const [selectedItem, setSelectedItem] = React.useState<Instrument | null>(null);
    const handleSelect = (item: Instrument | null) => {
        setSelectedItem(item);
    };

    React.useEffect(() => {
        loadCharts().then((appIntent) => {
            setChartApps(appIntent.apps);
        });
    }, []);

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
                {items && items.map((item) => {
                    return <SymbolsRow key={item.name} item={item} selected={item === selectedItem} chartApps={chartApps} handleSelect={handleSelect} />;
                })}
            </tbody>
        </table>
    );
}
