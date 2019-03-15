import * as React from 'react';
import * as fdc3 from '../../client/index';
import { DirectoryApplication } from '../../client/directory';

import '../../../res/demo/css/w3.css';

import { AppCard } from '../components/launcher/AppCard';

interface IAppState {
    applications: DirectoryApplication[];
}

export class LauncherApp extends React.Component<{}, IAppState> {
    constructor(props: {}) {
        super(props);

        document.title = "Launcher";
        this.state = {applications: []};

        fdc3.resolve(null!).then((applications: DirectoryApplication[]) => {
            this.setState({applications});
        });
    }

    public render(): JSX.Element {
        return (
            <div>
                <h1>Launcher</h1>

                {this.state.applications.map(
                    (app) => <AppCard key={app.appId} app={app} handleClick={this.openApp.bind(null, app)} />
                )}
            </div>
        );
    }

    private openApp(app: DirectoryApplication): void {
        console.log("Opening app " + app.title);
        fdc3.open(app.name);
    }
}