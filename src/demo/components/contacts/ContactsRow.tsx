import * as React from 'react';
import * as fdc3 from '../../../client/index';
import {ContactPayload} from '../../../client/context';
import {Contact} from '../../apps/ContactsApp';
import {IntentButton} from '../common/IntentButton';

import './ContactsRow.css';


interface ContactRowProps {
    item: Contact;
    selected: boolean;
    handleSelect: (item: Contact | null) => void;
}

// tslint:disable-next-line:variable-name
export const ContactsRow: React.FunctionComponent<ContactRowProps> = (props) => {
    const {item, selected, handleSelect} = props;

    const handleDial = (): Promise<void> => {
        if (handleSelect) {
            handleSelect(null);
        }
        return new fdc3.Intent(fdc3.Intents.DIAL_CALL, getContext()).send();
    };

    const handleCall = (): Promise<void> => {
        if (handleSelect) {
            handleSelect(null);
        }
        return new fdc3.Intent(fdc3.Intents.START_CALL, getContext()).send();
    };

    const handleClick = () => {
        if (handleSelect) {
            handleSelect(item);
            fdc3.broadcast(getContext());
        }
    };

    const getContext = (): ContactPayload => {
        return {
            type: "contact",
            name: item.name,
            id: {
                email: item.email!,
                phone: item.phone!
            }
        };
    };

    return (
        <tr className={"contacts-row" + (selected ? " w3-theme-l2" : "")} onClick={handleClick}>
            <td>{item.name}</td>
            <td>{item.email}</td>
            <td>{item.phone}</td>
            <td>
                <IntentButton action={handleDial} title="Dial" iconClassName="fa-tty" />
                <IntentButton action={handleCall} title="Call" iconClassName="fa-phone" />
            </td>
        </tr>
    );
};