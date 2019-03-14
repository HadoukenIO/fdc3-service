import * as React from 'react';
import {Payload} from '../../../client/context';

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

export const IntentButton: React.FunctionComponent<IntentButtonProps> = (props) => {
  const {action, title, iconClassName} = props;
  const [buttonState, setButtonState] = React.useState(ButtonStateType.DEFAULT);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setButtonState(ButtonStateType.SPIN);
    //Send intent
    action()
      .then(() => {
        setButtonState(ButtonStateType.DEFAULT);
      })
      .catch(err => {
        setButtonState(ButtonStateType.ERROR);
        alert(`Intent failed with message '${err.message}'`);
      });
  };

  // Only red when error state
  const buttonClassName = buttonState & ButtonStateType.ERROR ? "w3-red" : "";

  return (
    <button onClick={handleClick} className={buttonClassName}>
      <i className={buttonState === ButtonStateType.SPIN ? "fa fa-spinner fa-spin" : `fa ${iconClassName}`} title={title} />
    </button>
  );
};