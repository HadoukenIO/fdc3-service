import * as React from 'react';

import './CallTimer.css';

export function CallTimer(): React.ReactElement {
    const [counter, setCounter] = React.useState(0);
    const seconds: number = (counter % 60);
    const minutes: number = Math.floor(counter / 60) % 60;
    const hours: number = Math.floor(counter / 3600);

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCounter((counterLocal) => counterLocal + 1);
        }, 1000);
        // Cleanup
        return () => {
            clearInterval(timer);
        };
    }, []);

    return (
        <div className="call-timer w3-text-green w3-xlarge w3-center">
            {hours < 10 ? `0${hours}` : hours} : {minutes < 10 ? `0${minutes}` : minutes} : {seconds < 10 ? `0${seconds}` : seconds}
        </div>
    );
}
