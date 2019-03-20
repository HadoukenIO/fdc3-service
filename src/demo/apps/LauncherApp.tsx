import * as React from 'react';
import * as fdc3 from '../../client/main';
import {AppMetadata} from '../../client/main';
import {IApplication} from '../../client/directory';
import {AppCard} from '../components/launcher/AppCard';

import '../../../res/demo/css/w3.css';

export function LauncherApp(): React.ReactElement {
    const [applications, setApplications] = React.useState<AppMetadata[]>([]);

    React.useEffect(() => {
        document.title = "Launcher";
    }, []);

    React.useEffect(() => {
        fdc3.findIntent(null!)
            .then(async (appIntent) => setApplications(appIntent.apps))
            .catch(console.log);
    });

    const openApp = (app: IApplication) => {
        console.log(`Opening app ${app.title}`);
        fdc3.open(app.name)
            .then(() => console.log(`Opened app ${app.title}`))
            .catch(console.log);
    };

    return (
        <div>
            <h1>Launcher</h1>
            {applications.map((app, index) => <AppCard key={app.id + index} app={app} handleClick={openApp} />)}
        </div>
    );
}