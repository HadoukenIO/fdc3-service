import {Application} from '../../client/directory';

import {AppWindow} from './AppWindow';
import {DeferredPromise} from '../common/DeferredPromise';

/**
 * Represents a running appliction
 */
export class LiveApp {
    private readonly _windowsById: Map<string, AppWindow> = new Map();
    private readonly _appInfoDeferredPromise: DeferredPromise<Application> = new DeferredPromise();

    private _appInfo: Application | undefined;
    private _windowCount: number = 0;

    public get windows(): AppWindow[] {
        return Array.from(this._windowsById.values());
    }

    public get appInfo(): Application | undefined {
        return this._appInfo;
    }

    public async getAppInfo(): Promise<Application> {
        return this._appInfoDeferredPromise.promise;
    }

    public setAppInfo(appInfo: Application) {
        if (this._appInfo === undefined) {
            this._appInfo = appInfo;
            this._appInfoDeferredPromise.resolve(appInfo);
        }
    }

    public addWindow(window: AppWindow): void {
        this._windowsById.set(window.id, window);
    }

    public removeWindow(window: AppWindow): void {
        this._windowsById.delete(window.id);
    }

    public incrementWindows(): void {
        this._windowCount++;
    }

    public decrementWindows(): void {
        this._windowCount--;
    }

    public hasWindows(): boolean {
        return this._windowCount === 0;
    }
}
