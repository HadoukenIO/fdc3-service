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
    const viewData = (app.type === 'manifest')
        ? {
            title: app.data.title || app.data.appId,
            description: app.data.description || '',
            icon: (app.data.icons && app.data.icons[0] && app.data.icons[0].icon) || '',
            className: isDirectoryApp ? 'w3-blue-gray' : 'w3-light-blue'
        }
        : {
            title: app.data.name || app.data.uuid,
            description: app.data.description || '',
            icon: app.data.icon || '',
            className: 'w3-light-green'
        };

    return (
        <div className="app-card w3-card w3-hover-shadow" onClick={handleClick}>
            <img className={viewData.className} src={viewData.icon} />
            <div>
                <h6><b>{viewData.title}</b></h6>
                <p className="w3-small w3-text-grey">{viewData.description}</p>
            </div>
        </div>
    );
}
