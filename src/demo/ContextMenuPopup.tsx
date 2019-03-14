import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {ContextMenuItemType, ContextMenu, ContextMenuMessage} from './components/common/ContextMenu';

import '../../res/demo/css/w3.css';


const uuid: string = fin.desktop.Application.getCurrent().uuid;

/**
 * Simplification of ContextMenuItem - contains just the information required by the UI.
 */
export interface MenuItem {
    id: string;
    type: ContextMenuItemType;
    caption: string;
    hasChildren: boolean;
}

interface ContextMenuPopupProps {
    items?: MenuItem[];
    children?: React.ReactNode;
}

export function ContextMenuPopup(props: ContextMenuPopupProps): React.ReactElement {
    const [menuItems, setMenuItems] = React.useState<MenuItem[]>([]);
    let windowHeight = 2;

    React.useEffect(() => {
        const handleMenuMessage = (message: ContextMenuMessage) => {
            if (message.action === "update") {
                setMenuItems(message.items);
                const ofWindow = fin.Window.getCurrentSync();
                ofWindow.isShowing().then(showing => {
                    if (!showing) {
                        ofWindow.show();
                        ofWindow.focus();
                    }
                });
            }
        };
        fin.desktop.InterApplicationBus.subscribe(uuid, ContextMenu.TOPIC, handleMenuMessage);

        const listener = () => {
            sendMessage({action: "blur"});
        };
        fin.desktop.Window.getCurrent().addEventListener("blurred", listener);

        //Cleanup
        return () => {
            fin.desktop.InterApplicationBus.unsubscribe(uuid, ContextMenu.TOPIC, handleMenuMessage);
            fin.desktop.Window.getCurrent().removeEventListener('blurred', listener);
        };
    }, []);

    //Generate the menu items
    const items = React.useMemo(() => {
        return menuItems.map((item) => {
            let component: JSX.Element;
            let itemHeight = 22;
            const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault();
                onClick(item, event.currentTarget.offsetTop);
            };

            switch (item.type) {
                case ContextMenuItemType.SPINNER:
                    component = <button key={item.id} className="spinner w3-button w3-disabled"><i className="fa fa-spinner fa-spin" /></button>;
                    break;
                case ContextMenuItemType.SEPARATOR:
                    component = <hr key={item.id} />;
                    itemHeight = 7;
                    break;
                case ContextMenuItemType.LABEL:
                    component = <span key={item.id} className="w3-button">{item.caption}</span>;
                    break;
                case ContextMenuItemType.BUTTON:
                    component = <button key={item.id} className={"w3-button" + (item.hasChildren ? " children" : "")} onClick={handleClick}>{item.caption}</button>;
                    break;
                default:
                    component = <></>;
                    itemHeight = 0;
            }

            windowHeight += itemHeight;
            return component;
        });
    }, [menuItems]);

    if (window.innerHeight !== windowHeight) {
        fin.desktop.Window.getCurrent().resizeTo(150, windowHeight, "top-left");
    }


    return (<div className="context-menu">{items}</div>);
}


function sendMessage(message: ContextMenuMessage): void {
    fin.desktop.InterApplicationBus.send(uuid, ContextMenu.TOPIC, message);
}

function onClick(item: MenuItem, offsetTop: number): void {
    const anchor: {x: number; y: number;} = {
        x: window.screenX + outerWidth - 10,
        y: window.screenY + offsetTop
    };
    sendMessage({action: "select", id: item.id, anchor});
}


ReactDOM.render(<ContextMenuPopup />, document.getElementById('react-app'));
