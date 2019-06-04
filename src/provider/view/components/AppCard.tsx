import * as React from 'react';

import {Application} from '../../../client/directory';

import './AppCard.css';

interface AppCardProps {
    app: Application;
    selected: boolean;
    selectHandler: (app: Application) => void;
    openHandler: (app: Application) => void;
}

export function AppCard(props: AppCardProps): React.ReactElement {
    const {app, selected, openHandler, selectHandler} = props;
    const clickHandler = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        selectHandler(app);
    };
    const doubleClickHandler = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        openHandler(app);
    };
    const className = 'app-card w3-card w3-round-large w3-button' + (selected ? ' selected' : '');
    return (
        <div id={app.name} className={className} onClick={clickHandler} onDoubleClick={doubleClickHandler}>
            {(app.icons && app.icons.length > 0) && <img className="" src={app.icons![0].icon} />}
            <h3>{app.title || app.name}</h3>
            <div className="w3-clear" />
        </div>
    );
}
