import * as React from 'react';
import * as fdc3 from '../../client/index';
import {Number} from '../components/dialer/Number';
import {Dialer} from '../components/dialer/Dialer';
import {CallTimer} from '../components/dialer/CallTimer';
import {CallButton} from '../components/dialer/CallButton';
import {ContactPayload, Payload} from '../../client/context';
import {Dialog} from '../components/common/Dialog';

import '../../../res/demo/css/w3.css';
import {ColorLinker} from '../components/common/ColorLinker';

interface AppProps {
    phoneNumber?: string;
}

export function DialerApp(props: AppProps): React.ReactElement {
    const [inCall, setInCall] = React.useState(false);
    const [phoneNumber, setPhoneNumber] = React.useState<string>("");
    const [pendingCall, setPendingCall] = React.useState<ContactPayload | null>(null);

    const onNumberEntry = (phoneNumber: string) => setPhoneNumber(phoneNumber);
    const onDialerEntry = (key: string) => setPhoneNumber(phoneNumber + key);
    const toggleCall = () => setInCall(!inCall);
    const handleDialog = (option: string) => {
        if (option === "Yes") {
            setPhoneNumber(pendingCall!.id.phone!);
            setPendingCall(null);
        } else {
            setPendingCall(null);
        }
    };
    const handleIntent = (context: ContactPayload, startCall: boolean) => {
        const phoneNumber: string = context.id.phone!;
        if (phoneNumber) {
            setPhoneNumber(context.id.phone!);
            setInCall(startCall);
        } else {
            throw new Error("Contact doesn't have a phone number");
        }
    };

    React.useEffect(() => {
        document.title = "Dialer";
    }, []);

    // Setup listeners
    React.useEffect(() => {
        const dial = new fdc3.IntentListener(fdc3.Intents.DIAL_CALL, (context: Payload) => {
            if (!inCall) {
                handleIntent(context as ContactPayload, false);
            } else if (context.id.phone) {
                setPendingCall(context as ContactPayload);
            }
        });
        const call = new fdc3.IntentListener(fdc3.Intents.DIAL_CALL, (context: Payload) => {
            if (!inCall) {
                handleIntent(context as ContactPayload, true);
            } else if (context.id.phone) {
                setPendingCall(context as ContactPayload);
            }
        });
        const context = new fdc3.ContextListener((context: Payload) => {
            if (context.type === "contact") {
                if (!inCall) {
                    handleIntent(context as ContactPayload, false);
                }
            }
        });
        // Cleanup
        return () => {
            dial.unsubscribe();
            call.unsubscribe();
            context.unsubscribe();
        };
    }, []);

    return (
        <div>
            <Number inCall={inCall} number={phoneNumber} onValueChange={onNumberEntry} />
            {inCall && <CallTimer />}
            {!inCall && <Dialer handleKeyPress={onDialerEntry} />}
            <CallButton canCall={phoneNumber.length > 0} inCall={inCall} handleClick={toggleCall} />
            <Dialog show={!!pendingCall} title="Replace call?" body={"Hang up and call " + (pendingCall && pendingCall.id.phone) + "?"} options={["No", "Yes"]} handleOption={handleDialog} />
        </div>
    );
}