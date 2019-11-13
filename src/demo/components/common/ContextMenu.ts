import {WindowOption} from 'openfin/_v2/api/window/windowOption';
import {_Window} from 'openfin/_v2/api/window/window';
import {Point} from 'openfin/_v2/api/system/point';
import {Transition, Bounds} from 'openfin/_v2/shapes';

const defaultWindowOptions: WindowOption = {
    url: 'about:blank',
    shadow: true,
    showTaskbarIcon: false,
    autoShow: false,
    saveWindowState: false,
    defaultWidth: 200,
    defaultHeight: 200,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    maximizable: false,
    defaultLeft: 200,
    defaultTop: 200
};

export interface ContextMenuItem<T extends {}={}> {
    text: string;
    children?: ContextMenuItem[];
    payload?: T;
}

interface ContextMenuParameters {
    win: fin.OpenFinWindow;
    menuItems?: ContextMenuItem[];
    isRoot?: boolean;
}

// eslint-disable-next-line
type clickCallback<T extends {}={}> = (payload: T) => any;

class ContextMenu {
    /**
     * Factory function for creating context menus.
     *
     * @static
     * @memberof ContextMenu
     */
    public static async create(name?: string, isRoot: boolean = false) {
        name = name || (Math.random() * 1000).toString();
        const win: fin.OpenFinWindow = await this.createWindow({...defaultWindowOptions, name});
        return new ContextMenu({win, isRoot});
    }

    // Promise based v1 window creation
    private static async createWindow(options: WindowOption): Promise<fin.OpenFinWindow> {
        return new Promise<fin.OpenFinWindow>((resolve, reject) => {
            const win = new fin.desktop.Window(options, () => {
                resolve(win);
            }, (err) => {
                reject(err);
            });
        });
    }

    private readonly _windowV1: fin.OpenFinWindow;
    private readonly _window: _Window;
    private readonly _nativeWindow: Window;
    private _isShowing: boolean = false;
    private _child!: ContextMenu;

    private readonly transitionOut: Transition = {
        opacity: {
            opacity: 0,
            duration: 100
        }
    };

    private readonly transitionIn: Transition = {
        opacity: {
            opacity: 1,
            duration: 100
        }
    };

    private readonly _isRoot: boolean;

    public get isRoot() {
        return this._isRoot;
    }

    public get isShowing() {
        return this._isShowing;
    }

    private constructor({win, isRoot = false}: ContextMenuParameters) {
        this._windowV1 = win;
        this._nativeWindow = win.getNativeWindow();
        this._window = fin.Window.wrapSync({name: win.name, uuid: win.uuid});
        this._isRoot = isRoot;

        this.setStyle();

        // Add blur to the root context menu only
        if (isRoot) {
            this._windowV1.addEventListener('blurred', () => {
                this.hide();
            });
        }
    }

    /**
     * Check if [menuItems] has an children.
     * @memberof ContextMenu
     */
    public childCheck(menuItems: ContextMenuItem[]) {
        return menuItems.some((item) => item.children !== undefined);
    }

    /**
     * Set the context on the context menu.
     * @memberof ContextMenu
     */
    public async setContent<T extends {}={}>(menuItems: ContextMenuItem[], clickCallback: clickCallback<T>) {
        // Check that there is any children if so make a child node
        let child = this._child;
        if (this.childCheck(menuItems) && child === undefined) {
            child = await ContextMenu.create(`${this._window.identity.name}:child`, false);
            this._child = child;
        }
        const document = this._nativeWindow.document;
        document.body.innerHTML = '';
        const ul = document.createElement('ul');
        const itemHeight = 24; // @todo change this
        menuItems.forEach((item, index) => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.innerText = item.text;
            if (item.children) {
                const arrow = document.createElement('span');
                arrow.innerText = '▶';
                arrow.className = 'arrow';
                span.appendChild(arrow);
            }
            li.appendChild(span);

            li.addEventListener('mouseover', async () => {
                // Nothing to expand
                if (child && !item.children) {
                    child.hide();
                }
                if (child && item.children && child._child) {
                    child._child.hide();
                }
                if (item.children && item.children.length > 0) {
                    // Show next window
                    const bounds = await this._window.getBounds();
                    const position = {x: bounds.left + bounds.width, y: bounds.top + (itemHeight * index)};
                    await child.setContent(item.children, clickCallback);
                    child.showAt(position);
                }
            });

            li.addEventListener('click', () => {
                if (!item.children && item.payload) {
                    contextMenu.hide();
                    // eslint-disable-next-line
                    clickCallback(item.payload as any);
                }
            });

            ul.appendChild(li);
        });
        document.body.appendChild(ul);
        const height = this.outerHeight(ul);
        this._window.setBounds({height} as Bounds);
    }

    /**
     * Set the bounds of the window.
     *
     * @memberof ContextMenu
     */
    public async setBounds(newBounds: Partial<Bounds>) {
        const bounds = await this._window.getBounds();
        Object.assign(bounds, newBounds);
    }

    /**
     * Close this window and all its children.
     *
     * @memberof ContextMenu
     */
    public async destroy() {
        if (this._child) {
            await this._child.destroy();
        }
        this._window.close();
    }

    /**
     * Hide the window and all child windows.
     *
     * @memberof ContextMenu
     */
    public async hide() {
        const animateOptions = {
            interrupt: true,
            tween: 'ease-out'
        };
        if (this._child) {
            await this._child.hide();
        }
        this._isShowing = false;
        this._window.animate(this.transitionOut, animateOptions);
    }

    /**
     * Show the window at the given [point].
     *
     * @memberof ContextMenu
     */
    public showAt(point: Point, focus?: boolean) {
        const animateOptions = {
            interrupt: true,
            tween: 'ease-in'
        };
        this._window.show();
        this._isShowing = true;
        this._window.moveTo(point.x, point.y);
        if (focus) {
            this._window.focus();
        }
        this._window.animate(this.transitionIn, animateOptions);
    }

    public setStyle(css?: string) {
        const style = this._nativeWindow.document.createElement('link');
        style.rel = 'stylesheet';
        style.href = `${location.origin}/demo/css/context-menu.css`;
        this._nativeWindow.document.head.appendChild(style);
    }

    private outerHeight(element: HTMLElement) {
        let height: number = element.offsetHeight;
        const style = getComputedStyle(element);
        // tslint:disable-next-line:ban
        height += parseInt(style.marginTop!, 10) + parseInt(style.marginBottom!, 10);
        return height;
    }
}

let contextMenu: ContextMenu;

window.onunload = async (event: Event) => {
    await contextMenu.destroy();
};

export async function showContextMenu<T extends {}>(position: Point, items: ContextMenuItem<T>[], handleClick: (payload: T) => void) {
    if (!contextMenu) {
        contextMenu = await ContextMenu.create('root', true);
    }
    await contextMenu.setContent(items, handleClick);
    contextMenu.showAt(position, true);
}
