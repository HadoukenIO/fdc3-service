import * as React from 'react';

import './AppCard.css';
import {AppLaunchData} from '../../apps/LauncherApp';

interface AppCardProps {
    app: AppLaunchData;
    isDirectoryApp: boolean;
    handleClick?: (app: AppLaunchData) => void;
}

export function AppCard(props: AppCardProps): React.ReactElement {
    const {app, isDirectoryApp, handleClick: handler} = props;
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        if (handler) {
            handler(app);
        }
    };

    return (
        <div className="app-card w3-card w3-hover-shadow" onClick={handleClick}>
            {(app.type === 'manifest') ?
                (app.data.icons && app.data.icons.length > 0) &&
                    <img className={isDirectoryApp ? 'w3-blue-gray' : 'w3-light-blue'} src={app.data.icons[0].icon} /> :
                <img className={'w3-light-green'} src={app.data.icon} />
            }
            <div>
                <h6><b>{(app.type === 'manifest') ? app.data.title : app.data.name}</b></h6>
                <p className="w3-small w3-text-grey">{app.data.description}</p>
            </div>
        </div>
    );
}
