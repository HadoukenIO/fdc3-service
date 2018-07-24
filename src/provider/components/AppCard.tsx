import * as React from 'react';

import './AppCard.css';

import { IApplication } from '../../client/directory';

interface IAppCardProps {
    app: IApplication;
    selected: boolean;
    selectHandler: (app: IApplication) => void;
    openHandler: (app: IApplication) => void;
}

export class AppCard extends React.Component<IAppCardProps> {
    constructor(props: IAppCardProps) {
        super(props);

        this.clickHandler = this.clickHandler.bind(this);
        this.doubleClickHandler = this.doubleClickHandler.bind(this);
    }

    public render(): JSX.Element {
        let app: IApplication = this.props.app;

        return (
            <div className={"app-card w3-card w3-round-large w3-button" + (this.props.selected ? " selected" : "")} onClick={this.clickHandler} onDoubleClick={this.doubleClickHandler}>
                <img className="" src={app.icon} />
                <h3>{app.title}</h3>
                <div className="w3-clear"></div>
            </div>
        );
    }

    private clickHandler(event: React.MouseEvent<HTMLDivElement>): void {
        let handler = this.props.selectHandler;

        if (handler) {
            handler(this.props.app);
        }
    }

    private doubleClickHandler(event: React.MouseEvent<HTMLDivElement>): void {
        let handler = this.props.openHandler;

        if (handler) {
            handler(this.props.app);
        }
    }
}