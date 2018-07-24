import * as React from 'react';

import { ISymbol } from '../../apps/BlotterApp';
import { SymbolsRow } from './SymbolsRow';

interface ISymbolTableProps {
    items?: ISymbol[];
}

interface ISymbolTableState {
    selectedItem: ISymbol;
}

export class SymbolsTable extends React.Component<ISymbolTableProps, ISymbolTableState> {
    constructor(props: ISymbolTableProps) {
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
                        <th>Bid Size</th>
                        <th>Bid Price</th>
                        <th>Ask Size</th>
                        <th>Ask Price</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {this.props.items.map((item) => <SymbolsRow key={item.name} item={item} selected={item == this.state.selectedItem} handleSelect={this.handleSelect} />)}
                </tbody>
            </table>
        );
    }

    private handleSelect(item: ISymbol): void {
        if (item != this.state.selectedItem) {
            this.setState({selectedItem: item});
        }
    }
}
