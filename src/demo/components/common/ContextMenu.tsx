import * as React from 'react';

import {MenuItem} from '../../temp';

declare const window: Window & {ContextMenu: ContextMenu | null};

export enum ContextMenuItemType {
    BUTTON,     ///< A normal context menu button
    LABEL,      ///< Static text that can't be selected
    SEPARATOR,  ///< A separator between two parts of the context menu
    SPINNER     ///< A loading indicator
}

/**
 * Interface used to define a static hierarchy of menu items.
 * 
 * @see IAsyncContextMenuItem A similar interface, which allows the use of a promise to specify menu items asynchronously
 */
export interface StaticContextMenuItem {
    /**
     * Determines the appearance and interactivity of the menu item.
     * 
     * Will default to BUTTON.
     */
    type?: ContextMenuItemType;

    /**
     * User-visible text to display on the menu item. Only applies to BUTTON and LABEL types.
     */
    caption?: string;

    /**
     * Field for storing user data. Not used by the Context Menu.
     */
    userData?: UserData;

    /**
     * Optional set of child items to nest under this item
     */
    children?: StaticContextMenuItem[];

    /**
     * Function to call when this item is clicked. Applies only to BUTTON types.
     * 
     * There's also a top-level "handleSelection" callback, which will be called whenever any menu button is clicked.
     */
    callback?: () => void;
}

/**
 * The type used for specifying context menu items. This allows for static items, as well as promises that can return 
 * one or more items.
 */
export type ContextMenuItem = StaticContextMenuItem | AsyncContextMenuItem | Promise<StaticContextMenuItem | StaticContextMenuItem[]>;

// tslint:disable-next-line: no-any Its user data
export type UserData = any;

/**
 * Interface used to populate a context menu with items asynchronously.
 * 
 * @see ContextMenuItem 
 */
export interface AsyncContextMenuItem {
    type?: ContextMenuItemType;
    caption?: string;
    userData?: UserData;
    children?: ContextMenuItem[];
    callback?: () => void;
}

/**
 * When a context menu is opened, the item definition within the component's props will be parsed into a static format 
 * that removes any asynchronous components.
 * 
 * This is essentially a simplified version of the original menu definition, only promises have been replaced with 
 * 'spinner' elements, and any unspecified fields have been filled-in with default values.
 * 
 * @see ContextMenuItem
 * @see AsyncContextMenuItem
 */
export interface ParsedMenuItem {
    id: string;
    type: ContextMenuItemType;
    caption: string;
    userData: UserData;
    parent: ParsedMenuItem;
    children: ParsedMenuItem[];
    callback: () => void;
}

//Incoming messages (from ContextMenuPopup to ContextMenu)
interface SelectMessage {action: "select"; id: string; anchor: {x: number; y: number;};}
interface BlurMessage {action: "blur";}

//Outgoing messages (from ContextMenu to ContextMenuPopup)
interface UpdateMessage {action: "update"; items: MenuItem[];}

//Alias for any valid context menu message. All messages are sent along the IAB using ContextMenu.TOPIC as the topic.
export type ContextMenuMessage = SelectMessage | BlurMessage | UpdateMessage;

/**
 * Contains the state of a ContextMenu. This is lazily-created when the user first triggers the context menu.
 */
interface Menu {
    /**
     * Uniquely identifies a specific context menu, as there may be many ContextMenu components on a page
     */
    id: string;

    /**
     * A hierarchical list of items, derived from the AsyncContextMenuItem's that are passed in via props.
     * 
     * Any promises within the original item list will have been replaced with spinner items. When the promise 
     * resolves, the spinners will be replaced with whatever is returned.
     */
    root: ParsedMenuItem;

    /**
     * Lookup-map for quickly finding items by their ID.
     */
    map: {[id: string]: ParsedMenuItem};
}

/**
 * Wrapper object that manages the state of a single child window.
 */
interface Popup {
    menuState: Menu;
    item: ParsedMenuItem;
    window: fin.OpenFinWindow;
}

interface ContextMenuProps {
    items: ContextMenuItem[];
    handleSelection?: (type: ContextMenuItemType, userData: UserData) => void;
}

/**
 * React component that is capable of spawning a context menu. This component should be used to wrap one or more other
 * components. Whenever any of the nested components are right-clicked, a context-menu will be displayed.
 * 
 * Note that this component is only what spawns the context menu - when a menu is shown, it is created as a child 
 * window (or multiple child windows, if a menu item contains children). If multiple ContextMenu components exist on a
 * single page, they will share a common pool of popup menus.
 * 
 * Context menu items are defined through the props of this component. If the menu needs to display items that aren't
 * known at the time the page is created, the context menu definition can use a promise to specify menu items (or a 
 * subset of menu items) asynchronously.
 */
export class ContextMenu extends React.Component<ContextMenuProps> {
    public static TOPIC: string = "ContextMenu";

    private static UUID: string = fin.desktop.Application.getCurrent().uuid;
    private static POOL: {active: Popup[]; free: Popup[]} = {active: [], free: []};
    private static URL: string = window.location.href.replace("index", "contextMenu").split("?")[0];

    private menu: Menu | null = null;

    private static reserveWindows(count: number): void {
        const free: Popup[] = this.POOL.free;

        while (free.length < count) {
            free.push(this.createPopup());
        }
    }

    private static getOrCreatePopup(callback?: (popup: Popup) => void): Popup {
        let popup: Popup | undefined = this.POOL.free.pop();

        if (popup) {
            //Window is now active
            if (callback) {
                callback(popup);
            }
        } else {
            //Create a new (active) window
            popup = this.createPopup(callback);
        }

        //Add to active list
        this.POOL.active.push(popup);

        return popup;
    }

    private static createPopup(callback?: (popup: Popup) => void): Popup {
        let window: fin.OpenFinWindow;
        let popup: Popup;

        //Create window
        window = new fin.desktop.Window({
            name: this.createId("menu"),     //Window names must be unique
            url: ContextMenu.URL,
            autoShow: false,
            alwaysOnTop: true,
            frame: false,
            resizable: false,
            showTaskbarIcon: false,
            saveWindowState: false
        }, () => {
            if (callback) {
                callback(popup);
            }
        });
        popup = {
            menuState: null!,
            item: null!,
            window
        };

        return popup;
    }

    private static createId(prefix: string): string {
        return [prefix, Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)].join("-");
    }

    private static releasePopup(popup: Popup): void {
        const free: Popup[] = this.POOL.free;
        const active: Popup[] = this.POOL.active;
        const index: number = active.findIndex((activePopup: Popup) => activePopup.window.name === popup.window.name);

        if (index >= 0) {
            popup.item = null!;
            popup.menuState = null!;
            popup.window.hide();

            free.push(active[index]);
            active.splice(index, 1);
        } else {
            console.warn("Trying to free a window that hasn't come from this pool");
        }
    }

    constructor(props: ContextMenuProps) {
        super(props);

        if (!window.ContextMenu) {
            window.ContextMenu = this;
        }

        this.onClick = this.onClick.bind(this);
        this.onMenuMessage = this.onMenuMessage.bind(this);

        //There is a short delay when creating a window that we want to avoid when opening the context menu.
        //This will create a hidden window as soon as the component is initialised, the window will be shared across all ContextMenu-enabled elements within the application.
        ContextMenu.reserveWindows(1);
    }

    public componentWillUnmount(): void {
        if (this.menu) {
            fin.desktop.InterApplicationBus.unsubscribe(ContextMenu.UUID, ContextMenu.TOPIC, this.onMenuMessage);
            this.menu = null;
        }
    }

    public render(): JSX.Element {
        return (
            <span onClick={this.onClick}>
                {this.props.children}
            </span>
        );
    }

    private openMenu(item: ParsedMenuItem, screenX: number, screenY: number): Popup {
        if (!window.ContextMenu) {
            window.ContextMenu = this;
        }

        //Fetch window from pool
        return ContextMenu.getOrCreatePopup((popup: Popup) => {
            if (popup.item || popup.menuState) {
                console.warn("Popup menu wasn't fully freed from previous usage");
            }

            //Set state
            popup.item = item;
            popup.menuState = this.menu!;

            //Prepare window
            popup.window.moveTo(screenX, screenY);
            fin.desktop.InterApplicationBus.send(ContextMenu.UUID, popup.window.name, ContextMenu.TOPIC, {action: "update", items: this.createMenuItems(popup.item.children)});
        });
    }

    private createMenuItems(items: ParsedMenuItem[]): MenuItem[] {
        return items.map((item: ParsedMenuItem) => ({
            id: item.id,
            type: item.type,
            caption: item.caption,
            hasChildren: item.children.length > 0
        }));
    }

    private onClick(event: React.MouseEvent<HTMLSpanElement>): void {
        if (!this.menu) {
            //Initialise component state
            this.menu = {
                id: "contextMenu-" + Date.now(),
                root: {
                    id: "[root]",
                    type: ContextMenuItemType.BUTTON,
                    caption: "",
                    userData: undefined,
                    parent: null!,
                    children: [],
                    callback: null!
                },
                map: {}
            };

            //Create hierarchy of parsed menu items
            this.menu.root.children = this.mapItems(this.props.items, this.menu.root);

            //Listen to any messages coming from popup windows
            fin.desktop.InterApplicationBus.subscribe(ContextMenu.UUID, ContextMenu.TOPIC, this.onMenuMessage);
        }

        this.openMenu(this.menu.root, event.screenX, event.screenY);

        event.stopPropagation();
    }

    /**
     * Replaces any async items (i.e. promises) within the input with 'spinner' components.
     * 
     * Listeners are added to the promises that will replace the spinner components with the necessary items once the
     * promise has resolved.
     */
    private mapItem(item: ContextMenuItem, parent: ParsedMenuItem): ParsedMenuItem {
        let mappedItem: ParsedMenuItem;
        const idPrefix: string = parent ? (parent.id + "/") : "";

        if ((item as Promise<StaticContextMenuItem | StaticContextMenuItem[]>).then) {
            //Item is a promise
            const promise: Promise<StaticContextMenuItem | StaticContextMenuItem[]> = item as Promise<StaticContextMenuItem | StaticContextMenuItem[]>;
            const placeholderId: string = idPrefix + ContextMenu.createId("promise");

            //Add promise listener
            Promise.all([
                promise,
                new Promise<void>((resolve: () => void) => setTimeout(resolve, 500))
            ]).then((result: [StaticContextMenuItem | StaticContextMenuItem[], void]) => {
                this.replacePlaceholder(placeholderId, result[0]);
            }, (reason: string) => {
                this.replacePlaceholder(placeholderId, {type: ContextMenuItemType.LABEL, caption: "Error"});
            });

            //Return a placeholder "SPINNER" item, which will be replaced once the promise resolves
            mappedItem = {
                id: placeholderId,
                type: ContextMenuItemType.SPINNER,
                parent,
                caption: placeholderId,     //Use caption field to store a temporary identifier. Lets us find the placeholder again later, so we can swap it out.
                userData: undefined,
                children: [],
                callback: null!
            };
        } else {
            const sourceItem: AsyncContextMenuItem = item as AsyncContextMenuItem;

            //Must first create mapped item without any children
            mappedItem = Object.assign({
                //Additional fields
                id: idPrefix + (sourceItem.caption || ContextMenu.createId(ContextMenuItemType[sourceItem.type || ContextMenuItemType.BUTTON].toLowerCase())),
                parent,

                //Enusre all optional fields are set
                type: ContextMenuItemType.BUTTON,
                caption: "",
                userData: undefined,
                callback: null
            }, sourceItem, {
                    children: []
                });

            //Once item has been created, can map each of it's children
            if (sourceItem.children) {
                mappedItem.children = this.mapItems(sourceItem.children, mappedItem);
            }
        }

        this.menu!.map[mappedItem.id] = mappedItem;

        return mappedItem;
    }

    private mapItems(items: ContextMenuItem[], parent: ParsedMenuItem): ParsedMenuItem[] {
        return items.map((childItem: ContextMenuItem) => this.mapItem(childItem, parent));
    }

    private replacePlaceholder(placeholderId: string, value: StaticContextMenuItem | StaticContextMenuItem[]): void {
        const placeholder: ParsedMenuItem = this.menu!.map[placeholderId];
        const replacement: StaticContextMenuItem[] = (value instanceof Array) ? value : [value];

        if (value && placeholder) {
            const parsedItems: ParsedMenuItem[] = this.mapItems(replacement, placeholder.parent);
            const parent: ParsedMenuItem = (placeholder.parent || this.menu!.root);
            const siblings: ParsedMenuItem[] = parent.children;
            const index: number = siblings.indexOf(placeholder);
            let menuItems: MenuItem[] | null = null;

            if (index >= 0) {
                //Replace placeholder with values returned by promise

                // tslint:disable-next-line: no-any
                siblings.splice.apply(siblings, ([index, 1] as any).concat(parsedItems));

                //Remove placeholder from lookup
                delete this.menu!.map[placeholderId];

                //Refresh window
                ContextMenu.POOL.active.forEach((popup: Popup) => {
                    if (popup.item === parent) {
                        if (!menuItems) {
                            menuItems = this.createMenuItems(parent.children);
                        }

                        this.sendMessage(popup, {action: "update", items: menuItems});
                    }
                });
            } else {
                console.warn("ContextMenu hierarchy has become corrupted");
            }
        } else if (!placeholder) {
            console.warn("Invalid placeholder, no item with ID " + placeholderId);
        } else if (!value) {
            console.warn("Promise didn't return any replacement items");
        }
    }

    private onMenuMessage(message: ContextMenuMessage, uuid: string, name: string): void {
        const popup: Popup | undefined = ContextMenu.POOL.active.find((popup: Popup) => popup.window.name === name);

        if (popup && popup.menuState === this.menu) {
            if (message.action === "select") {
                const item: ParsedMenuItem = this.menu.map[message.id];
                const handler = this.props.handleSelection;

                if (item) {
                    if (item.callback) {
                        item.callback();
                    }

                    if (item.children.length > 0) {
                        this.openMenu(item, message.anchor.x, message.anchor.y);
                    } else {
                        if (handler) {
                            handler(item.type, item.userData);
                        }

                        this.closeMenu();
                    }
                } else {
                    console.error("Clicked an item that wasn't in the menu map: " + message.id);
                }
            } else if (message.action === "blur") {
                const activePopups: Popup[] = ContextMenu.POOL.active;
                const blurredPopup: Popup | undefined = activePopups.find((activePopup: Popup) => activePopup.window.name === name);
                const childIds: string[] = blurredPopup ? blurredPopup.item.children.map((childItem: ParsedMenuItem) => childItem.id) : [];

                if (activePopups.findIndex((activePopup: Popup) => (activePopup !== blurredPopup && childIds.indexOf(activePopup.item.id) >= 0)) === -1) {
                    //Menu has been blurred, and not because we've just opened a child menu.
                    this.closeMenu();
                }
            }
        } else if (!popup) {
            console.error("Received a context menu message from a window not managed by ContextMenu");
        }
    }

    private closeMenu(): void {
        const activePopups: Popup[] = ContextMenu.POOL.active;

        //Close all popups that belong to this menu
        activePopups.slice().forEach((activePopup: Popup) => {
            if (activePopup.menuState === this.menu) {
                ContextMenu.releasePopup(activePopup);
            }
        });
    }

    private sendMessage(popup: Popup, message: ContextMenuMessage): void {
        fin.desktop.InterApplicationBus.send(ContextMenu.UUID, popup.window.name, ContextMenu.TOPIC, message);
    }
}