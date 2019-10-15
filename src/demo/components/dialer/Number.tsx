import * as React from 'react';

import './Number.css';

interface NumberProps {
    inCall: boolean;
    number: string;
    onValueChange?: (num: string) => void;
}

export function Number(props: NumberProps) {
    const {onValueChange: handleValueChange, inCall, number: phoneNumber} = props;
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const inputFilter: RegExp = /[^0-9*#]/g;
        const {value} = event.currentTarget;
        const filterValue = value.replace(inputFilter, '');
        if (handleValueChange) {
            handleValueChange(filterValue);
        }
    };
    const handleClear = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        event.currentTarget.focus();
        if (handleValueChange) {
            handleValueChange('');
        }
    };

    return (
        <div className="number">
            <i className={`fa fa-close w3-button w3-text-gray${inCall ? ' w3-hide' : ''}`} onClick={handleClear} />
            <input className="number-input w3-input w3-border" type="text" value={phoneNumber} onChange={handleChange} readOnly={inCall} />
        </div>
    );
}
