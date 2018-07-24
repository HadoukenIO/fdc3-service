import * as React from 'react';

import './Dialog.css';

interface IDialogProps {
    show?: boolean;
    title?: string;
    body?: string;
    options?: string[];

    handleOption?: (option: string)=>void;
}

export class Dialog extends React.Component<IDialogProps> {
    constructor(props: IDialogProps) {
        super(props);

        this.onClick = this.onClick.bind(this);
    }

    public render(): JSX.Element {
        if (this.props.show) {
            return (
                <div className={"dialog w3-modal" + (this.props.show ? " w3-show" : "")}>
                    <div className="w3-modal-content w3-center w3-round-xlarge">
                        {this.props.title ? <h2>{this.props.title}</h2> : null}
                        {this.props.body ? <p>{this.props.body}</p> : null}

                        {this.props.options.map((option: string, index: number) => (
                            <button className="w3-button w3-border w3-round" key={index} onClick={this.onClick}>{option}</button>
                        ))}
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }

    private onClick(event: React.MouseEvent<HTMLButtonElement>): void {
        let handler: (option: string)=>void = this.props.handleOption;

        if (handler) {
            handler(event.currentTarget.innerText);
        }
    }
}