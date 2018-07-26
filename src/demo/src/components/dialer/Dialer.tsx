import * as React from 'react';

import './Dialer.css';

interface IDialerProps {
    handleKeyPress?: (key: string) => void;
}

export class Dialer extends React.Component<IDialerProps> {
    constructor(props: {}) {
        super(props);

        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    public render(): JSX.Element {
        return (
            <div className="dialer">
                <div className="w3-row">
                    {[this.createButton("1"), this.createButton("2"), this.createButton("3")]}
                </div>
                <div className="w3-row">
                    {[this.createButton("4"), this.createButton("5"), this.createButton("6")]}
                </div>
                <div className="w3-row">
                    {[this.createButton("7"), this.createButton("8"), this.createButton("9")]}
                </div>
                <div className="w3-row">
                    {[this.createButton("*"), this.createButton("0"), this.createButton("#")]}
                </div>
            </div>
        );
    }

    private createButton(button: string): JSX.Element {
        return <button key={button} onClick={this.handleKeyPress} value={button}>{button}</button>;
    }

    private handleKeyPress(event: React.MouseEvent<HTMLButtonElement>): void {
        var handler: (key: string) => void = this.props.handleKeyPress;

        if (handler) {
            handler((event.target as HTMLButtonElement).value);
        }
    }
}