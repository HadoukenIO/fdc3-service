import * as React from 'react';

import './Dialog.css';

interface DialogProps {
    show?: boolean;
    title?: string;
    body?: string;
    options?: string[];

    handleOption?: (option: string)=>void;
}

export class Dialog extends React.Component<DialogProps> {
    constructor(props: DialogProps) {
        super(props);

        this.onClick = this.onClick.bind(this);
    }

    public render(): JSX.Element|null {
        const {show, title, body, options} = this.props;
        if (show) {
            return (
                <div className={"dialog w3-modal" + (show ? " w3-show" : "")}>
                    <div className="w3-modal-content w3-center w3-round-xlarge">
                        {title && <h2>{title}</h2>}
                        {body && <p>{body}</p>}

                        {options && options.map((option: string, index: number) => (
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
        const handler: ((option: string)=>void)|undefined = this.props.handleOption;

        if (handler) {
            handler(event.currentTarget.innerText);
        }
    }
}