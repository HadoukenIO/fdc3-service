import * as React from 'react';
import {Application} from '../../client/directory';
import {RaiseIntentPayload, SERVICE_CHANNEL} from '../../client/internal';
import {DefaultAction} from '../index';

import {AppCard} from './AppCard';

import './AppList.css';

interface IntentData {
    handle: number;
    intent: RaiseIntentPayload;
    applications: Application[];
}

const sendError = (service: Promise<ChannelClient>, handle: number, reason: string) => {
    service.then((client) => {
        client.dispatch('FDC3.SelectorResult', {success: false, handle, reason});
    });
};

const sendSuccess = (service: Promise<ChannelClient>, handle: number, app: Application, defaultAction: string) => {
    service.then((client) => {
        client.dispatch('FDC3.SelectorResult', {success: true, handle, app, defaultAction});
    });
};

export function AppList(): React.ReactElement {
    const [service, setService] = React.useState<Promise<ChannelClient>>();
    const [handle, setHandle] = React.useState<number>(0);
    const [applications, setApplications] = React.useState<Application[]>([]);
    const [defaultAction, setDefaultAction] = React.useState<string>("ALWAYS_ASK");
    const [selectedApplication, setSelectedApplication] = React.useState<Application | null>(null);

    const onAppSelect = (app: Application) => setSelectedApplication(app);
    const onAppOpen = (app: Application) => sendSuccess(service!, handle, app, "ALWAYS_ASK");
    const onSelectDefault = (event: React.ChangeEvent<HTMLSelectElement>) => setDefaultAction(event.currentTarget.value);
    const onOpen = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        sendSuccess(service!, handle, selectedApplication!, defaultAction);
    };
    const onCancel = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        sendError(service!, handle, 'Cancelled');
    };


    React.useEffect(() => {
        const service = fin.InterApplicationBus.Channel.connect(SERVICE_CHANNEL);

        setService(service);

        fin.Application
            .getCurrentSync()
            .getWindow()
            .then(w => w.getOptions()
                .then((options) => {
                    const data: IntentData = JSON.parse(options.customData);

                    if (data && data.intent && data.applications) {
                        setHandle(data.handle);
                        setApplications(data.applications);
                    } else if (data) {
                        // customData was malformed
                        sendError(service, data.handle, 'Invalid intent data');
                    } else {
                        // customData was missing
                        sendError(service, 0, 'No intent data');
                    }
                })
                .catch(() => {
                    // Couldn't fetch window options
                    sendError(service, 0, 'No window data');
                }));
    }, []);


    return (
        <div className="app-list">
            <h2 className="app-header">Select an appliction:</h2>
            <div className="list-section app-container">
                {applications.map((app: Application) => (
                    <AppCard key={app.appId} app={app} selectHandler={onAppSelect} openHandler={onAppOpen} selected={selectedApplication === app} />
                ))}
            </div>
            <div className="list-section w3-border-top w3-light-grey">
                <h2>Set default action:</h2>
                <div id="actions" className={selectedApplication ? '' : 'w3-disabled'}>
                    <select className="default-action w3-select" onChange={onSelectDefault}>
                        <option value={DefaultAction.ALWAYS_ASK}>Always ask</option>
                        <option value={DefaultAction.ALWAYS_FOR_INTENT}>Remember my selection</option>
                        <option value={DefaultAction.ALWAYS_FOR_APP}>Remember for this application only</option>
                    </select>

                    <div className="open-btn w3-button w3-bar w3-green w3-large" onClick={onOpen}>Open Application</div>
                </div>
                <div className="w3-button w3-bar w3-red w3-small" onClick={onCancel}>Cancel</div>
            </div>
        </div>
    );
}
