import * as React from 'react';

import './Number.css';

interface INumberProps {
    inCall?: boolean;
    number?: string;
    handleChange?: (number: string) => void;
}

interface INumberState {
    inCall: boolean;
    number: string;
}

export class Number extends React.Component<INumberProps, INumberState> {
    private inputFilter: RegExp = /[^0-9*#]/g;

    constructor(props: INumberProps) {
        super(props);

        this.state = {
            inCall: props.inCall || false,
            number: props.number || ""
        };

        this.handleChange = this.handleChange.bind(this);
        this.handleClear = this.handleClear.bind(this);
    }

    public render(): JSX.Element {
        return (
            <div className="number">
                <i className={"fa fa-close w3-button w3-text-gray" + (this.props.inCall ? " w3-hide" : "")} onClick={this.handleClear}></i>
                <input className="number-input w3-input w3-border" type="text" value={this.props.number} onChange={this.handleChange} readOnly={this.props.inCall} />
            </div>
        );
    }

    private handleChange(event: React.ChangeEvent<HTMLInputElement>): void {
        var handler: (key: string) => void = this.props.handleChange,
            input: string = event.target.value,
            filteredInput: string = input.replace(this.inputFilter, "");

        if (filteredInput != input) {
            event.target.value = filteredInput;
        } else if (handler) {
            handler(input);
        }
    }

    private handleClear(event: React.MouseEvent<HTMLElement>): void {
        var handler: (key: string) => void = this.props.handleChange,
            input: HTMLInputElement = document.getElementsByClassName("number-input")[0] as HTMLInputElement;

        if (handler) {
            handler("");
        }

        input.focus();
    }
}
