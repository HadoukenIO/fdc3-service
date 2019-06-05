import * as React from 'react';

import {Application} from '../../../client/directory';
import {ResolverArgs, ResolverResult} from '../../controller/ResolverHandler';

import {AppCard} from './AppCard';

let sendSuccess: (result: {app: Application}) => void;
let sendError: (result: string) => void;

export function AppList(): React.ReactElement {
    const [applications, setApplications] = React.useState<Application[]>([]);

    const onAppOpen = (app: Application) => sendSuccess({app});
    const onCancel = (event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        sendSuccess(null!);
    };


    React.useEffect(() => {
        fin.InterApplicationBus.Channel.create('resolver').then(channel => {
            Object.assign(window, {channel});

            channel.register('resolve', async (args: ResolverArgs) => {
                setApplications(args.applications);

                return new Promise<ResolverResult>((resolve, reject) => {
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
