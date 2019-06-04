import * as React from 'react';

import {Application} from '../../../client/directory';
import {SelectorArgs, SelectorResult} from '../../controller/SelectorHandler';

import {AppCard} from './AppCard';

let sendSuccess: (result: {app: Application, action: string}) => void;
let sendError: (result: string) => void;

export function AppList(): React.ReactElement {
    const [applications, setApplications] = React.useState<Application[]>([]);

    const onAppOpen = (app: Application) => sendSuccess({app, action: 'ALWAYS_ASK'});
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
        <div>
            <div id="header">
                <h1>Select an Application</h1>
                <div id="exit" onClick={onCancel}></div>
            </div>
            <div id="app-list">
                <p>Apps</p>
                <ul>
                    {applications.map((app: Application) => (
                        <AppCard key={app.appId} app={app} openHandler={onAppOpen} />
                    ))}
                </ul>
            </div>
        </div>
    );
}
