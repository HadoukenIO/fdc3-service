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
            await fin.Application.startFromManifest(app.manifest);
            console.log(`Launched app ${app.title}`);
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
            {applications.map((app, index) => <AppCard key={app.appId + index} app={app} handleClick={openApp} isDirectoryApp />)}
            <hr/>
            <h2>Non-directory apps</h2>
            {NON_DIRECTORY_APPS.map((app, index) => <AppCard key={app.appId + index} app={app} handleClick={launchApp} />)}
        </div>
    );
}

const NON_DIRECTORY_APPS: Application[] = ([
    ['blotter', 'blotter'],
    ['contacts', 'contacts'],
    ['dialer', 'dialer'],
    ['charts-red', 'charts'],
    ['charts-green', 'charts'],
    ['charts-blue', 'charts'],
    ['news', 'news']
] as Array<[string, string]>).map(([id, icon]) => ({
    appId: `${id}-nodir`,
    name: `${id}-nodir`,
    manifestType: 'openfin',
    manifest: `http://localhost:3923/demo/configs/non-directory/app-${id}-nodir.json`,
    icons: [
        {icon: `http://localhost:3923/demo/img/app-icons/${icon}.svg`}
    ],
    title: `${id}`,
    description: `Sample ${id} (no dir)`
}));
