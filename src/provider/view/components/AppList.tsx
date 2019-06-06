import * as React from 'react';

import {Application} from '../../../client/directory';

import {AppCard} from './AppCard';

import './AppList.css';

interface AppListProps {
    applications: Application[];
    openHandler: (app: Application) => void;
}

export function AppList(props: AppListProps): React.ReactElement {
    return (
        <div id="app-list">
            <p>Apps</p>
            <ul>
                {props.applications.map((app: Application) => (
                    <AppCard key={app.appId} app={app} openHandler={props.openHandler} />
                ))}
            </ul>
        </div>
    );
}
