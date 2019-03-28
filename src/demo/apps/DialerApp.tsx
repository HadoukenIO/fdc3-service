import * as React from 'react';

import * as fdc3 from '../../client/main';
import {Number} from '../components/dialer/Number';
import {Dialer} from '../components/dialer/Dialer';
import {CallTimer} from '../components/dialer/CallTimer';
import {CallButton} from '../components/dialer/CallButton';
import {ContactContext, Context} from '../../client/context';
import {Dialog} from '../components/common/Dialog';

import '../../../res/demo/css/w3.css';

interface AppProps {
    phoneNumber?: string;
}

export function DialerApp(props: AppProps): React.ReactElement {
    const [inCall, setInCall] = React.useState(false);
    const [phoneNumber, setPhoneNumber] = React.useState<string>('');
    const [pendingCall, setPendingCall] = React.useState<ContactContext | null>(null);

    const onNumberEntry = (phoneNumber: string) => setPhoneNumber(phoneNumber);
    const onDialerEntry = (key: string) => setPhoneNumber(phoneNumber + key);
    const toggleCall = () => setInCall(!inCall);
    const handleDialog = (option: string) => {
        if (option === 'Yes') {
            setPhoneNumber(pendingCall!.id.phone!);
            setPendingCall(null);
        } else {
            setPendingCall(null);
        }
    };
    const handleIntent = (context: ContactContext, startCall: boolean) => {
        const phoneNumber: string = context.id.phone!;
        if (phoneNumber) {
            setPhoneNumber(context.id.phone!);
            setInCall(startCall);
        } else {
            throw new Error('Contact doesn\'t have a phone number');
        }
    };

    React.useEffect(() => {
        document.title = 'Dialer';
    }, []);

    // Setup listeners
    React.useEffect(() => {
        const dialListener = fdc3.addIntentListener(fdc3.Intents.DIAL_CALL, (context: Context) => {
            if (!inCall) {
                handleIntent(context as ContactContext, false);
            } else if (context.id && context.id.phone) {
                setPendingCall(context as ContactContext);
            }
        });
        const callListener = fdc3.addIntentListener(fdc3.Intents.START_CALL, (context: Context) => {
            if (!inCall) {
                handleIntent(context as ContactContext, true);
            } else if (context.id && context.id.phone) {
                setPendingCall(context as ContactContext);
            }
        });
        const contextListener = fdc3.addContextListener((context: Context) => {
            if (context.type === 'contact') {
                if (!inCall) {
                    handleIntent(context as ContactContext, false);
                }
            }
        });
        // Cleanup
        return () => {
            dialListener.unsubscribe();
            callListener.unsubscribe();
            contextListener.unsubscribe();
        };
    }, []);

    return (
        <div>
            <Number inCall={inCall} number={phoneNumber} onValueChange={onNumberEntry} />
            {inCall && <CallTimer />}
            {!inCall && <Dialer handleKeyPress={onDialerEntry} />}
            <CallButton canCall={phoneNumber.length > 0} inCall={inCall} handleClick={toggleCall} />
            <Dialog
                show={!!pendingCall}
                title="Replace call?"
                body={'Hang up and call ' + (pendingCall && pendingCall.id.phone) + '?'}
                options={['No', 'Yes']} handleOption={handleDialog}
            />
        </div>
    );
}
