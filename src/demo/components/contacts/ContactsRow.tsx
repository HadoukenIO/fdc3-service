import * as React from 'react';

import /* type */ {ContactContext} from '../../../client/context';
import /* type */ {AppIntent} from '../../../client/main';
import {Contact} from '../../apps/ContactsApp';
import {IntentButton} from '../common/IntentButton';
import {fdc3} from '../../stub';

import './ContactsRow.css';

interface ContactRowProps {
    item: Contact;
    selected: boolean;
    handleSelect: (item: Contact | null) => void;
    appIntents: AppIntent[];
}

export function ContactsRow(props: ContactRowProps): React.ReactElement {
    const {item, selected, handleSelect} = props;

    const handleAppIntent = async (appIntent: AppIntent): Promise<void> => {
        if (handleSelect) {
            handleSelect(null);
        }
        await fdc3.raiseIntent(appIntent.intent.name, getContext());
    };

    const getIntentIcon = (appIntent: AppIntent): string => {
        if (appIntent && appIntent.apps.length > 0 && appIntent.apps[0].intents) {
            const intent = appIntent.apps[0].intents.find((intentLocal) => intentLocal.name === appIntent.intent.name);
            if (intent && intent.customConfig) {
                return intent.customConfig.icon;
            }
        }
        return 'fa-file';
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        if (handleSelect) {
            handleSelect(item);
            fdc3.broadcast(getContext());
        }
    };

    const getContext = (): ContactContext => {
        return {
            type: 'fdc3.contact',
            name: item.name,
            id: {
                email: item.email!,
                phone: item.phone!
            }
        };
    };

    return (
        <tr className={`contacts-row${selected ? ' w3-theme-l2' : ''}`} onClick={handleClick}>
            <td>{item.name}</td>
            <td>{item.email}</td>
            <td>{item.phone}</td>
            <td>
                {
                    (props.appIntents || []).map((appIntent) => (
                        <IntentButton
                            key={appIntent.intent.name}
                            action={() => handleAppIntent(appIntent)}
                            title={appIntent.intent.displayName}
                            iconClassName={getIntentIcon(appIntent)}
                        />
                    ))
                }
            </td>
        </tr>
    );
}
