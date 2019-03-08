import * as React from 'react';

import './CallButton.css';

interface CallButtonProps {
    inCall: boolean;
    canCall: boolean;
    handleClick?: () => void;
}

interface CallButtonState{
    inCall: boolean;
    canCall: boolean;
}

export class CallButton extends React.Component<CallButtonProps, CallButtonState> {
    constructor(props: CallButtonProps) {
        super(props);

        this.state = {
            inCall: props.inCall || false,
            canCall: props.canCall || false
        };

        this.handleClick = this.handleClick.bind(this);
    }

    public render(): JSX.Element {
        const {inCall} = this.props;
        const isEnabled: boolean = inCall || this.props.canCall;

        return (
            <button className={"call-btn w3-button " + (inCall ? "w3-red" : "w3-green")} disabled={!isEnabled} onClick={this.handleClick}>{inCall ? "End Call" : "Call"}</button>
        );
    }

    private handleClick(event: React.MouseEvent<HTMLButtonElement>): void {
        const {canCall, inCall} = this.props;
        const handler: (()=>void)|undefined = this.props.handleClick;

        if (handler && (inCall || canCall)) {
            handler();
        }
    }
}
