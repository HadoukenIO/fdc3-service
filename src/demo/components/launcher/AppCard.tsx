import * as React from 'react';

import './AppCard.css';

import {DirectoryApplication} from '../../../client/directory';

interface AppCardProps {
    app: DirectoryApplication;
    handleClick?: (app: DirectoryApplication) => void;
}

export function AppCard(props: AppCardProps): React.ReactElement {
    const {app, handleClick: handler} = props;
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        if (handler) {
            handler(app);
        }
    };

    return (
        <div className="app-card w3-card w3-hover-shadow" onClick={handleClick}>
            {(app.icons && app.icons.length > 0) && <img className="w3-blue-gray" src={app.icons![0].icon} />}
            <div>
                <h6><b>{app.title}</b></h6>
                <p className="w3-small w3-text-grey">{app.description}</p>
            </div>
        </div>
    );
}