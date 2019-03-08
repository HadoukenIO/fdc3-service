import * as React from 'react';

import './AppCard.css';

import { IApplication } from '../../../client/directory';

interface AppCardProps {
    app: IApplication;
    handleClick?: (app: IApplication) => void;
}

export class AppCard extends React.Component<AppCardProps> {
    constructor(props: AppCardProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    public render(): JSX.Element {
        const app: IApplication = this.props.app;

        return (
            <div className="app-card w3-card w3-hover-shadow" onClick={this.handleClick}>
                <img className="w3-blue-gray" src={app.icon} />
                <div>
                    <h6><b>{app.title}</b></h6>
                    <p className="w3-small w3-text-grey">{app.description}</p>
                </div>
            </div>
        );
    }

    private handleClick(event: React.MouseEvent<HTMLDivElement>): void {
        const handler: ((app: IApplication)=>void)|undefined = this.props.handleClick;

        if (handler) {
            handler(this.props.app);
        }
    }
}
