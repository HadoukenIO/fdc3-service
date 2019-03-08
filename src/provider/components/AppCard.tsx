import * as React from 'react';
import { IApplication } from '../../client/directory';

import './AppCard.css';

interface AppCardProps {
    app: IApplication;
    selected: boolean;
    selectHandler: (app: IApplication) => void;
    openHandler: (app: IApplication) => void;
}

export class AppCard extends React.Component<AppCardProps> {
    constructor(props: AppCardProps) {
        super(props);

        this.clickHandler = this.clickHandler.bind(this);
        this.doubleClickHandler = this.doubleClickHandler.bind(this);
    }

    public render(): JSX.Element {
        const app: IApplication = this.props.app;

        return (
            <div className={"app-card w3-card w3-round-large w3-button" + (this.props.selected ? " selected" : "")} onClick={this.clickHandler} onDoubleClick={this.doubleClickHandler}>
                <img className="" src={app.icon} />
                <h3>{app.title}</h3>
                <div className="w3-clear" />
            </div>
        );
    }

    private clickHandler(event: React.MouseEvent<HTMLDivElement>): void {
        const handler = this.props.selectHandler;

        if (handler) {
            handler(this.props.app);
        }
    }

    private doubleClickHandler(event: React.MouseEvent<HTMLDivElement>): void {
        const handler = this.props.openHandler;

        if (handler) {
            handler(this.props.app);
        }
    }
}