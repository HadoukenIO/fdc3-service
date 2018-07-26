import * as React from 'react';

import './CallButton.css';

interface ICallButtonProps {
    inCall?: boolean;
    canCall?: boolean;
    handleClick?: () => void;
}

export class CallButton extends React.Component<ICallButtonProps> {
    constructor(props: ICallButtonProps) {
        super(props);

        this.state = {
            inCall: props.inCall || false,
            canCall: props.canCall || false
        };

        this.handleClick = this.handleClick.bind(this);
    }

    public render(): JSX.Element {
        var inCall: boolean = this.props.inCall,
            isEnabled: boolean = inCall || this.props.canCall;

        return (
            <button className={"call-btn w3-button " + (inCall ? "w3-red" : "w3-green")} disabled={!isEnabled} onClick={this.handleClick}>{inCall ? "End Call" : "Call"}</button>
        );
    }

    private handleClick(event: React.MouseEvent<HTMLButtonElement>): void {
        var handler: ()=>void = this.props.handleClick;

        if (handler && (this.props.inCall || this.props.canCall)) {
            handler();
        }
    }
}
