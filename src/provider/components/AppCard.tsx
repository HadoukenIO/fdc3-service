import * as React from 'react';

import './AppCard.css';

import { DirectoryApplication } from '../../client/directory';

interface IAppCardProps {
    app: DirectoryApplication;
    selected: boolean;
    selectHandler: (app: DirectoryApplication) => void;
    openHandler: (app: DirectoryApplication) => void;
}

export class AppCard extends React.Component<IAppCardProps> {
    constructor(props: IAppCardProps) {
        super(props);

        this.clickHandler = this.clickHandler.bind(this);
        this.doubleClickHandler = this.doubleClickHandler.bind(this);
    }

    public render(): JSX.Element {
        const app: DirectoryApplication = this.props.app;

        return (
            <div className={"app-card w3-card w3-round-large w3-button" + (this.props.selected ? " selected" : "")} onClick={this.clickHandler} onDoubleClick={this.doubleClickHandler}>
                {(app.icons && app.icons.length > 0) && <img className="" src={app.icons![0].icon} />}
                <h3>{app.title}</h3>
                <div className="w3-clear"></div>
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