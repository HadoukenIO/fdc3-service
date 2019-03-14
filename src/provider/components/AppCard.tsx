import * as React from 'react';
import {IApplication} from '../../client/directory';

import './AppCard.css';

interface AppCardProps {
    app: IApplication;
    selected: boolean;
    selectHandler: (app: IApplication) => void;
    openHandler: (app: IApplication) => void;
}

export function AppCard(props: AppCardProps): React.ReactElement {
    const {app, selected, openHandler, selectHandler} = props;
    const clickHandler = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        selectHandler(app);
    };
    const doubleClickHandler = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        openHandler(app);
    };
    return (
        <div className={"app-card w3-card w3-round-large w3-button" + (selected ? " selected" : "")} onClick={clickHandler} onDoubleClick={doubleClickHandler}>
            <img src={app.icon} />
            <h3>{app.title}</h3>
            <div className="w3-clear" />
        </div>
    );
}