import * as React from 'react';

import './Dialog.css';

interface DialogProps {
    show?: boolean;
    title?: string;
    body?: string;
    options?: string[];
    handleOption?: (option: string) => void;
}

// tslint:disable-next-line:variable-name
export const Dialog: React.FunctionComponent<DialogProps> = (props) => {
    const {show, title, body, options, handleOption} = props;
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (handleOption) {
            handleOption(event.currentTarget.innerText);
        }
    };

    if (!show) {
        return <></>;
    }

    return (
        <div className={"dialog w3-modal" + (show ? " w3-show" : "")}>
            <div className="w3-modal-content w3-center w3-round-xlarge">
                {title && <h2>{title}</h2>}
                {body && <p>{body}</p>}

                {options && options.map((option: string, index: number) => (
                    <button className="w3-button w3-border w3-round" key={index} onClick={handleClick}>{option}</button>
                ))}
            </div>
        </div>
    );
};