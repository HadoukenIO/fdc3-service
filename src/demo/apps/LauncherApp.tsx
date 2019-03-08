import * as React from 'react';
import * as fdc3 from '../../client';
import { IApplication } from '../../client/directory';

import '../../../res/demo/css/w3.css';

import { AppCard } from '../components/launcher/AppCard';

interface AppState {
    applications: IApplication[];
}

export class LauncherApp extends React.Component<{}, AppState> {
    constructor(props: {}) {
        super(props);

        document.title = "Launcher";
        this.state = {applications: []};

        fdc3.resolve(null!)
        .then((applications: IApplication[]) => {
            this.setState({applications});
        })
        .catch(err =>{
            console.log(err);
        });
    }

    public render(): JSX.Element {
        const {applications} = this.state;
        return (
            <div>
                <h1>Launcher</h1>
                {
                    applications.map((app) => <AppCard key={app.id} app={app} handleClick={this.openApp.bind(null, app)} />
                )}
            </div>
        );
    }

    private openApp(app: IApplication): void {
        fdc3.open(app.name)
        .then(value => {
            console.log("Opening app " + app.title);
        })
        .catch(err => {
            console.log("Failed opening " + app.title, err, app);
        });
    }
}