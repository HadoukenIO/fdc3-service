import * as React from 'react';
import * as ReactDOM from 'react-dom';

import '../public/css/w3.css';

import { eContextMenuItem, ContextMenu, ContextMenuMessage } from './components/common/ContextMenu';

var uuid: string = fin.desktop.Application.getCurrent().uuid;

/**
 * Simplification of IContextMenuItem - contains just the information required by the UI.
 */
export interface IMenuItem {
    id: string;
    type: eContextMenuItem;
    caption: string;
    hasChildren: boolean;
}

interface IPopupState {
    items: IMenuItem[];
}

class ContextMenuPopup extends React.Component<{}, IPopupState> {
    constructor(props: {}) {
        super(props);

        this.state = {items: []};

        this.onClick = this.onClick.bind(this);
        this.onChildClosed = this.onChildClosed.bind(this);
        this.handleMenuMessage = this.handleMenuMessage.bind(this);

        fin.desktop.InterApplicationBus.subscribe(uuid, ContextMenu.TOPIC, this.handleMenuMessage.bind(this));
        fin.desktop.Window.getCurrent().addEventListener("blurred", () => {
            this.sendMessage({action: "blur"});
        });
    }

    public render(): JSX.Element {
        //Create menu components
        let menuItems: IMenuItem[] = this.state.items;
        let components: JSX.Element[] = [];
        let windowHeight: number = 2;   //Initial height is to account for top/bottom borders

        menuItems.forEach((item: IMenuItem) => {
            let itemHeight: number = 22;

            switch(item.type) {
                case eContextMenuItem.SPINNER:
                    components.push(<button key={item.id} className="spinner w3-button w3-disabled"><i className="fa fa-spinner fa-spin"></i></button>);
                    break;
                case eContextMenuItem.SEPARATOR:
                    components.push(<hr key={item.id} />);
                    itemHeight = 7;
                    break;
                case eContextMenuItem.LABEL:
                    components.push(<span key={item.id} className="w3-button">{item.caption}</span>);
                    break;
                case eContextMenuItem.BUTTON:
                    components.push(<button key={item.id} className={"w3-button" + (item.hasChildren ? " children" : "")} onClick={this.onClick.bind(this, item)}>{item.caption}</button>);
                    break;
                default:
            }

            windowHeight += itemHeight;
        });

        if (window.innerHeight != windowHeight) {
            fin.desktop.Window.getCurrent().resizeTo(150, windowHeight, "top-left");
        }

        return (<div className="context-menu">{components}</div>);
    }
    
    private onClick(item: IMenuItem, event: React.MouseEvent<HTMLButtonElement>): void {
        let anchor: {x: number; y: number;} = {
            x: window.screenX + outerWidth - 10, 
            y: window.screenY + event.currentTarget.offsetTop
        };

        this.sendMessage({action: "select", id: item.id, anchor});
    }
    
    private sendMessage(message: ContextMenuMessage): void {
        fin.desktop.InterApplicationBus.send(uuid, ContextMenu.TOPIC, message);
    }

    private onChildClosed(event: fin.WindowBaseEvent): void {
        window.focus();
    }

    private handleMenuMessage(message: ContextMenuMessage): void {
        if (message.action == "update") {
            this.setState({items: message.items});

            let ofWindow: fin.OpenFinWindow = fin.desktop.Window.getCurrent();
            if (!ofWindow.isShowing()) {
                ofWindow.show();
                ofWindow.focus();
            }
        }
    }
}

ReactDOM.render(<ContextMenuPopup />, document.getElementById('react-app'));
