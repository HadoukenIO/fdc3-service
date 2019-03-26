import * as React from 'react';
import {Application} from '../../client/directory';
import {AppCard} from './AppCard';
import {SelectorArgs, SelectorResult, DefaultAction} from '../controller/SelectorHandler';

import './AppList.css';

let sendSuccess: (result: {app: Application, action: string}) => void;
let sendError: (result: string) => void;

export function AppList(): React.ReactElement {
    const [applications, setApplications] = React.useState<Application[]>([]);
    const [defaultAction, setDefaultAction] = React.useState<string>("ALWAYS_ASK");
    const [selectedApplication, setSelectedApplication] = React.useState<Application | null>(null);

    const onAppSelect = (app: Application) => setSelectedApplication(app);
    const onAppOpen = (app: Application) => sendSuccess({app, action: "ALWAYS_ASK"});
    const onSelectDefault = (event: React.ChangeEvent<HTMLSelectElement>) => setDefaultAction(event.currentTarget.value);
    const onOpen = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        sendSuccess({app: selectedApplication!, action: defaultAction});
    };
    const onCancel = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        sendSuccess(null!);
    };


    React.useEffect(() => {
        fin.InterApplicationBus.Channel.create('selector').then(channel => {
            Object.assign(window, {channel});

            channel.register('resolve', async (args: SelectorArgs) => {
                setApplications(args.applications);

                return new Promise<SelectorResult>((resolve, reject) => {
                    sendSuccess = resolve;
                    sendError = reject;
                });
            });
        });
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
                <div id="actions" className={selectedApplication ? "" : "w3-disabled"}>
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