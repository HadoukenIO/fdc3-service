import * as React from 'react';
import * as fdc3 from '../../client/index';

import './AppList.css';

import { IApplication } from '../../client/directory';
import { AppCard } from './AppCard';
import { eDefaultAction } from '../index';

interface IAppListState {
    handle: number;
    defaultAction: string;
    applications: IApplication[];
    selectedApplication: IApplication;
}

interface IIntentData {
    handle: number;
    intent: fdc3.Intent;
    applications: IApplication[];
}

const servicePromise: Promise<fin.OpenFinServiceClient> = fin.desktop.Service.connect({uuid: "fdc3-service", name: "FDC3 Service"});

export class AppList extends React.Component<{}, IAppListState> {
    constructor(props: {}) {
        super(props);

        this.state = {
            handle: 0,
            defaultAction: "ALWAYS_ASK",
            applications: [],
            selectedApplication: null
        };
        this.onAppSelect = this.onAppSelect.bind(this);
        this.onAppOpen = this.onAppOpen.bind(this);
        this.onSelectDefault = this.onSelectDefault.bind(this);
        this.onOpen = this.onOpen.bind(this);
        this.onCancel = this.onCancel.bind(this);

        fin.desktop.Application.getCurrent().getWindow().getOptions((options: fin.WindowOptions) => {
            let data: IIntentData = options.customData;

            if (data && data.intent && data.applications) {
                this.setState({
                    handle: data.handle,
                    applications: data.applications
                });
            } else if (data) {
                //customData was malformed
                this.sendError(data.handle, "Invalid intent data");
            } else {
                //customData was missing
                this.sendError(0, "No intent data");
            }
        }, (reason: string) => {
            //Couldn't fetch window options
            this.sendError(0, "No window data");
        });
    }

    public render(): JSX.Element {
        return (
            <div className="app-list">
                <h2 className="app-header">Select an appliction:</h2>
                <div className="list-section app-container">
                    {this.state.applications.map((app: IApplication) => (
                        <AppCard key={app.id} app={app} selectHandler={this.onAppSelect} openHandler={this.onAppOpen} selected={this.state.selectedApplication == app} />
                    ))}
                </div>
                
                <div className="list-section w3-border-top w3-light-grey">
                    <h2>Set default action:</h2>
                    <div id="actions" className={this.state.selectedApplication ? "" : "w3-disabled"}>
                        <select className="default-action w3-select" onChange={this.onSelectDefault}>
                            <option value={eDefaultAction.ALWAYS_ASK}>Always ask</option>
                            <option value={eDefaultAction.ALWAYS_FOR_INTENT}>Remember my selection</option>
                            <option value={eDefaultAction.ALWAYS_FOR_APP}>Remember for this application only</option>
                        </select>

                        <div className="open-btn w3-button w3-bar w3-green w3-large" onClick={this.onOpen}>Open Application</div>
                    </div>
                    <div className="w3-button w3-bar w3-red w3-small" onClick={this.onCancel}>Cancel</div>
                </div>
            </div>
        );
    }

    private onAppSelect(app: IApplication): void {
        this.setState({selectedApplication: app});
    }

    private onAppOpen(app: IApplication): void {
        this.sendSuccess(this.state.handle, app, "ALWAYS_ASK");
    }

    private onSelectDefault(event: React.ChangeEvent<HTMLSelectElement>): void {
        this.setState({defaultAction: event.currentTarget.value});
    }

    private onOpen(event: React.MouseEvent<HTMLDivElement>): void {
        this.sendSuccess(this.state.handle, this.state.selectedApplication, this.state.defaultAction);
    }

    private onCancel(event: React.MouseEvent<HTMLDivElement>): void {
        this.sendError(this.state.handle, "Cancelled");
    }

    private sendSuccess(handle: number, app: IApplication, defaultAction: string): void {
        servicePromise.then((service: fin.OpenFinServiceClient) => {
            service.dispatch("FDC3.SelectorResult", {success: true, handle, app, defaultAction});
        });
    }

    private sendError(handle: number, reason: string): void {
        servicePromise.then((service: fin.OpenFinServiceClient) => {
            service.dispatch("FDC3.SelectorResult", {success: false, handle, reason});
        });
    }
}