import * as React from 'react';

import {Application} from '../../../../client/types/directory';
import {AppCard} from '../AppCard/AppCard';

import './AppList.scss';

interface AppListProps {
    applications: Application[];
    onAppOpen: (app: Application) => void;
}

export function AppList(props: AppListProps): React.ReactElement {
    return (
        <div className="app-list">
            <p>Available Applications</p>
            <ul>
                {props.applications.map((app: Application) => (
                    <AppCard key={app.appId || app.name} app={app} openHandler={props.onAppOpen} />
                ))}
            </ul>
        </div>
    );
}
