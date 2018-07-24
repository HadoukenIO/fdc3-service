import * as React from 'react';

import './CallTimer.css';

interface ICallTimerState {
    timer: number;
    counter: number;
}

export class CallTimer extends React.Component<{}, ICallTimerState> {
    constructor(props: {}) {
        super(props);

        this.state = {
            timer: null,
            counter: 0
        };

        this.tick = this.tick.bind(this);
    }

    public componentDidMount() {
        let timer: number = setInterval(this.tick, 1000) as any;
        this.setState({timer, counter: 0});
    }

    public componentWillUnmount() {
        clearInterval(this.state.timer);
        this.setState({timer: null, counter: this.state.counter});
    }

    public render(): JSX.Element {
        let time: number = this.state.counter;

        let seconds: number = (time % 60),
            minutes: number = Math.floor(time / 60) % 60,
            hours: number = Math.floor(time / 3600);

        return (
            <div className="call-timer w3-text-green w3-xlarge w3-center">
                {hours < 10 ? "0" + hours : hours} : {minutes < 10 ? "0" + minutes : minutes} : {seconds < 10 ? "0" + seconds : seconds}
            </div>
        );
    }

    private tick() {
        this.setState({
            counter: this.state.counter + 1
        });
    }
}