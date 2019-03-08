import * as React from 'react';
import * as fdc3 from '../../client/index';

import '../../../res/demo/css/w3.css';

import { Number } from '../components/dialer/Number';
import { Dialer } from '../components/dialer/Dialer';
import { CallTimer } from '../components/dialer/CallTimer';
import { CallButton } from '../components/dialer/CallButton';
import { ContactPayload, Payload } from '../../client/context';
import { Dialog } from '../components/common/Dialog';

interface IAppProps {
    phoneNumber?: string;
}

interface IAppState {
    inCall: boolean;
    phoneNumber: string;
    pendingCall: ContactPayload|null;
}

export class DialerApp extends React.Component<IAppProps, IAppState> {
    constructor(props: IAppProps) {
        super(props);

        //Initialise App UI
        document.title = "Dialer";
        this.state = {
            inCall: false,
            phoneNumber: props.phoneNumber || "",
            pendingCall: null
        };
        this.onNumberEntry = this.onNumberEntry.bind(this);
        this.onDialerEntry = this.onDialerEntry.bind(this);
        this.toggleCall = this.toggleCall.bind(this);
        this.handleDialog = this.handleDialog.bind(this);

        //Add FDC3 listeners
        const dialListener = new fdc3.IntentListener(fdc3.Intents.DIAL_CALL, (context: Payload): void => {
            if (!this.state.inCall) {
                this.handleIntent(context as ContactPayload, false);
            } else if (context.id.phone) {
                this.setState({pendingCall: context as ContactPayload});
            }
        });
        const callListener = new fdc3.IntentListener(fdc3.Intents.START_CALL, (context: Payload): void => {
            if (!this.state.inCall) {
                this.handleIntent(context as ContactPayload, true);
            } else if (context.id.phone) {
                this.setState({pendingCall: context as ContactPayload});
            }
        });
        const contextListener = new fdc3.ContextListener((context: Payload): void => {
            if (context.type === "contact") {
                if (!this.state.inCall) {
                    this.handleIntent(context as ContactPayload, false);
                }
            }
        });
    }

    public render(): JSX.Element {
        const pendingCall: ContactPayload = this.state.pendingCall!;
        const {inCall, phoneNumber} = this.state;
        return (
            <div>
                <Number inCall={this.state.inCall} number={phoneNumber} handleChange={this.onNumberEntry} />
                {inCall && <CallTimer />}
                {!inCall && <Dialer handleKeyPress={this.onDialerEntry} />}
                <CallButton canCall={phoneNumber.length > 0} inCall={inCall} handleClick={this.toggleCall} />
                <Dialog show={!!pendingCall} title="Replace call?" body={"Hang up and call " + (pendingCall && pendingCall.id.phone) + "?"} options={["No", "Yes"]} handleOption={this.handleDialog} />
            </div>
        );
    }

    private onNumberEntry(phoneNumber: string): void {
        this.setState({phoneNumber});
    }

    private onDialerEntry(key: string): void {
        this.setState({phoneNumber: this.state.phoneNumber + key});
    }

    private toggleCall(): void {
        this.setState({inCall: !this.state.inCall});
    }

    private handleDialog(option: string): void {
        if (option === "Yes") {
            this.setState({
                phoneNumber: this.state.pendingCall!.id.phone!,
                pendingCall: null
            });
        } else {
            this.setState({pendingCall: null});
        }
    }

    private handleIntent(context: ContactPayload, startCall: boolean): void {
        const phoneNumber: string = context.id.phone!;

        if (phoneNumber) {
            this.setState({
                phoneNumber: context.id.phone!,
                inCall: startCall
            });
        } else {
            throw new Error("Contact doesn't have a phone number");
        }
    }
}