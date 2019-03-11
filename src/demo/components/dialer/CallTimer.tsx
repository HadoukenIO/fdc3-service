import * as React from 'react';

import './CallTimer.css';

// tslint:disable-next-line:variable-name
export const CallTimer: React.FunctionComponent = () => {
    const [timer, setTimer] = React.useState();
    const [counter, setCounter] = React.useState(0);
    const seconds: number = (counter % 60),
        minutes: number = Math.floor(counter / 60) % 60,
        hours: number = Math.floor(counter / 3600);
    const tick = () => {
        setCounter(counter + 1);
    };

    React.useEffect(() => {
        setTimer(setInterval(tick, 1000));

        //Cleanup
        return () => {
            clearInterval(timer);
        };
    }, []);

    return (
        <div className="call-timer w3-text-green w3-xlarge w3-center">
            {hours < 10 ? "0" + hours : hours} : {minutes < 10 ? "0" + minutes : minutes} : {seconds < 10 ? "0" + seconds : seconds}
        </div>
    );
};
