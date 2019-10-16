import {Application} from '../../client/directory';

import {AppWindow} from './AppWindow';

/**
 * Represents a running appliction
 */
export class LiveApp {
    public readonly appInfo: Application;

    private readonly _windowsById: Map<string, AppWindow> = new Map();

    public get windows(): AppWindow[] {
        return Array.from(this._windowsById.values());
    }

    public constructor(appInfo: Application) {
        this.appInfo = appInfo;
    }

    public addWindow(window: AppWindow): void {
        this._windowsById.set(window.id, window);
    }

    public removeWindow(window: AppWindow): void {
        this._windowsById.delete(window.id);
    }

    public hasWindows(): boolean {
        return this._windowsById.size > 0;
    }
}
