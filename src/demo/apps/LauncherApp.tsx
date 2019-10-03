import * as React from 'react';

import * as fdc3 from '../../client/main';
import {Application} from '../../client/directory';
import {AppCard} from '../components/launcher/AppCard';

import '../../../res/demo/css/w3.css';

export function LauncherApp(): React.ReactElement {
    const [applications, setApplications] = React.useState<Application[]>([]);

    React.useEffect(() => {
        document.title = 'Launcher';
    }, []);

    React.useEffect(() => {
        fdc3.findIntent(null!)
            .then(async (appIntent) => setApplications(appIntent.apps))
            .catch(console.error);
    }, []);

    const openApp = async (app: Application) => {
        console.log(`Opening app ${app.title}`);
        try {
            await fdc3.open(app.appId);
            console.log(`Opened app ${app.title}`);
        } catch (e) {
            // Stringifying an `Error` omits the message!
            const error: any = {
                message: e.message,
                ...e
            };
            console.error(e, error);
        }
    };

    const launchApp = async (app: Application) => {
        console.log(`Launching app ${app.title}`);
        try {
            try {
                await fin.Application.startFromManifest(app.manifest);
                console.log(`Launched app ${app.title}`);
            } catch (e) {
                if (/Application with specified UUID is already running/.test(e.message)) {
                    const window = fin.Window.wrapSync({uuid: app.appId, name: app.appId});
                    await window.setAsForeground();
                    console.log(`App ${app.title} was already running - focused`);
                } else {
                    throw e;
                }
            }
        } catch (e) {
            // Stringifying an `Error` omits the message!
            const error: any = {
                message: e.message,
                ...e
            };
            console.error(e, error);
        }
    };

    return (
        <div>
            <h1>Launcher</h1>
            {applications.map((app, index) => <AppCard key={app.appId + index} app={app} handleClick={openApp} isDirectoryApp={true} />)}
            <hr/>
            <h2>Non-directory apps</h2>
            {NON_DIRECTORY_APPS.map((app, index) => <AppCard key={app.appId + index} app={app} handleClick={launchApp} isDirectoryApp={false} />)}
        </div>
    );
}

const NON_DIRECTORY_APPS: Application[] = ([
    {id: 'blotter', icon: 'blotter', title: 'Blotter', description: 'Sample non-directory blotter app'},
    {id: 'contacts', icon: 'contacts', title: 'Contacts', description: 'Sample non-directory contacts app'},
    {id: 'dialer', icon: 'dialer', title: 'Dialer', description: 'Sample non-directory dialer app'},
    {id: 'charts-pink', icon: 'charts', title: 'Charts: Pink', description: 'A non-directory charting app'},
    {id: 'charts-grey', icon: 'charts', title: 'Charts: Grey', description: 'Another non-directory charting app'},
    {id: 'charts-teal', icon: 'charts', title: 'Charts: Teal', description: 'Another non-directory charting app'},
    {id: 'news', icon: 'news', title: 'News Feed', description: 'Sample non-directory news app'}
] as Array<{id: string, icon: string, title: string, description: string}>).map(({id, icon, title, description}) => ({
    appId: `fdc3-${id}-nodir`,
    name: `fdc3-${id}-nodir`,
    manifestType: 'openfin',
    manifest: `http://localhost:3923/demo/configs/non-directory/app-${id}-nodir.json`,
    icons: [
        {icon: `http://localhost:3923/demo/img/app-icons/${icon}.svg`}
    ],
    title: title || id,
    description
}));
