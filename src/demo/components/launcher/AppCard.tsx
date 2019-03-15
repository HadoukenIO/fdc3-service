import * as React from 'react';

import './AppCard.css';

import { DirectoryApplication } from '../../../client/directory';

interface IAppCardProps {
    app: DirectoryApplication;
    handleClick?: (app: DirectoryApplication) => void;
}

export class AppCard extends React.Component<IAppCardProps> {
    constructor(props: IAppCardProps) {
        super(props);

        this.handleClick = this.handleClick.bind(this);
    }

    public render(): JSX.Element {
        const app: DirectoryApplication = this.props.app;

        return (
            <div className="app-card w3-card w3-hover-shadow" onClick={this.handleClick}>
                {(app.icons && app.icons.length > 0) && <img className="w3-blue-gray" src={app.icons![0].icon} />}
                <div>
                    <h6><b>{app.title}</b></h6>
                    <p className="w3-small w3-text-grey">{app.description}</p>
                </div>
            </div>
        );
    }

    private handleClick(event: React.MouseEvent<HTMLDivElement>): void {
        const handler: ((app: DirectoryApplication)=>void)|undefined = this.props.handleClick;

        if (handler) {
            handler(this.props.app);
        }
    }
}
