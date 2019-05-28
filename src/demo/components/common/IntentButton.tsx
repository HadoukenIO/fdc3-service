import * as React from 'react';

import {IntentResolution} from '../../../client/main';

interface IntentButtonProps {
  title?: string;
  iconClassName?: string;
  action: () => Promise<void>;
}

enum ButtonStateType {
  DEFAULT,
  SPIN,
  ERROR
}

export function IntentButton(props: IntentButtonProps): React.ReactElement {
    const {action, title, iconClassName} = props;
    const [buttonState, setButtonState] = React.useState(ButtonStateType.DEFAULT);
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setButtonState(ButtonStateType.SPIN);
        // Send intent
        action()
            .then(() => {
                setButtonState(ButtonStateType.DEFAULT);
            })
            .catch(err => {
                setButtonState(ButtonStateType.ERROR);
                // Alert commented out as per https://github.com/HadoukenIO/fdc3-service/pull/87/files/d637737b8e74e858d8cc978f1fa9755e3ad6c308#r288216259
                // alert(`Intent failed with message '${err.message}'`);
            });
    };

    // Only red when error state
    const buttonClassName = buttonState & ButtonStateType.ERROR ? 'w3-red' : '';

    return (
        <button onClick={handleClick} className={buttonClassName}>
            <i className={buttonState === ButtonStateType.SPIN ? 'fa fa-spinner fa-spin' : `fa ${iconClassName}`} title={title} />
        </button>
    );
}
