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
            // alert(`openApp threw an error!\n${JSON.stringify(error)}`);
        }
    };

    return (
        <div>
            <h1>Launcher</h1>
            {applications.map((app, index) => <AppCard key={app.appId + index} app={app} handleClick={openApp} />)}
        </div>
    );
}
