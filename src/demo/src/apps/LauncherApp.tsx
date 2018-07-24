import * as React from 'react';
import * as fdc3 from '../../../client/index';
import { IApplication } from '../../../client/directory';

import '../../public/css/w3.css';

import { AppCard } from '../components/launcher/AppCard';

interface IAppState {
    applications: IApplication[]
}

export class LauncherApp extends React.Component<{}, IAppState> {
    constructor(props: {}) {
        super(props);

        document.title = "Launcher";
        this.state = {applications: []};

        fdc3.resolve(null, null).then((applications: IApplication[]) => {
            this.setState({applications});
        });
    }

    public render(): JSX.Element {
        return (
            <div>
                <h1>Launcher</h1>

                {this.state.applications.map(
                    (app) => <AppCard key={app.id} app={app} handleClick={this.openApp.bind(null, app)} />
                )}
            </div>
        );
    }

    private openApp(app: IApplication): void {
        console.log("Opening app " + app.title);
        fdc3.open(app.name);
    }
}