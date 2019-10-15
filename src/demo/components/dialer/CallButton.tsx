import * as React from 'react';

import './CallButton.css';

interface CallButtonProps {
    inCall: boolean;
    canCall: boolean;
    handleClick?: () => void;
}

export function CallButton(props: CallButtonProps): React.ReactElement {
    const {handleClick: handler, canCall, inCall} = props;
    const isEnabled: boolean = inCall || canCall;
    const handleClick = () => {
        if (handler && (inCall || canCall)) {
            handler();
        }
    };
    return (
        <button className={`call-btn w3-button ${inCall ? 'w3-red' : 'w3-green'}`} disabled={!isEnabled} onClick={handleClick}>
            {inCall ? 'End Call' : 'Call'}
        </button>
    );
}
