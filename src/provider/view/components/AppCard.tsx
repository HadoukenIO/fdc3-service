import * as React from 'react';

import {Application} from '../../../client/directory';

interface AppCardProps {
    app: Application;
    openHandler: (app: Application) => void;
}

export function AppCard(props: AppCardProps): React.ReactElement {
    const {app, openHandler} = props;

    const clickHandler = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        openHandler(app);
    };
    return (
        <li onClick={clickHandler}>
            {(app.icons && app.icons.length > 0) && <img className="icon" src={app.icons![0].icon} />}
            <h1>{app.title}</h1>
        </li>
    );
}
