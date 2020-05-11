import * as React from 'react';

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
            .catch((err) => {
                setButtonState(ButtonStateType.ERROR);
            });
    };

    // Only red when error state
    const buttonClassName = buttonState & ButtonStateType.ERROR ? 'w3-red' : '';

    return (
        <button onClick={handleClick} className={buttonClassName}>
            <i className={buttonState === ButtonStateType.SPIN ? 'fa fa-spinner fa-pulse' : `fa ${iconClassName}`} title={title} />
        </button>
    );
}
