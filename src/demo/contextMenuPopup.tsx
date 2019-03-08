import * as React from 'react';
import * as ReactDOM from 'react-dom';

import '../../res/demo/css/w3.css';

import { ContextMenuItemType, ContextMenu, ContextMenuMessage } from './components/common/ContextMenu';

const uuid: string = fin.desktop.Application.getCurrent().uuid;

/**
 * Simplification of IContextMenuItem - contains just the information required by the UI.
 */
export interface MenuItem {
    id: string;
    type: ContextMenuItemType;
    caption: string;
    hasChildren: boolean;
}

interface PopupState {
    items: MenuItem[];
}

class ContextMenuPopup extends React.Component<{}, PopupState> {
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
        const menuItems: MenuItem[] = this.state.items;
        const components: JSX.Element[] = [];
        let windowHeight: number = 2;   //Initial height is to account for top/bottom borders

        menuItems.forEach((item: MenuItem) => {
            let itemHeight: number = 22;

            switch(item.type) {
                case ContextMenuItemType.SPINNER:
                    components.push(<button key={item.id} className="spinner w3-button w3-disabled"><i className="fa fa-spinner fa-spin" /></button>);
                    break;
                case ContextMenuItemType.SEPARATOR:
                    components.push(<hr key={item.id} />);
                    itemHeight = 7;
                    break;
                case ContextMenuItemType.LABEL:
                    components.push(<span key={item.id} className="w3-button">{item.caption}</span>);
                    break;
                case ContextMenuItemType.BUTTON:
                    components.push(<button key={item.id} className={"w3-button" + (item.hasChildren ? " children" : "")} onClick={this.onClick.bind(this, item)}>{item.caption}</button>);
                    break;
                default:
            }

            windowHeight += itemHeight;
        });

        if (window.innerHeight !== windowHeight) {
            fin.desktop.Window.getCurrent().resizeTo(150, windowHeight, "top-left");
        }

        return (<div className="context-menu">{components}</div>);
    }
    
    private onClick(item: MenuItem, event: React.MouseEvent<HTMLButtonElement>): void {
        const anchor: {x: number; y: number;} = {
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
        if (message.action === "update") {
            this.setState({items: message.items});

            const ofWindow: fin.OpenFinWindow = fin.desktop.Window.getCurrent();
            ofWindow.isShowing((showing) => {
                if(!showing) {
                    ofWindow.show();
                    ofWindow.focus();
                }
            });
        }
    }
}

ReactDOM.render(<ContextMenuPopup />, document.getElementById('react-app'));
