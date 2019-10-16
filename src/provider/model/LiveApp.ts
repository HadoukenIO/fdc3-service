import {Application} from '../../client/directory';
import {DeferredPromise} from '../common/DeferredPromise';
import {Timeouts} from '../constants';

import {AppWindow} from './AppWindow';

/**
 * Represents a running appliction
 */
export class LiveApp {
    private readonly _windowsById: Map<string, AppWindow> = new Map();
    private readonly _appInfoDeferredPromise: DeferredPromise<Application> = new DeferredPromise();

    private readonly _startedPromise: Promise<void>;
    private readonly _maturePromise: Promise<void>;

    private _appInfo: Application | undefined;
    private _mature: boolean = false;

    public get windows(): AppWindow[] {
        return Array.from(this._windowsById.values());
    }

    public get appInfo(): Application | undefined {
        return this._appInfo;
    }

    public get mature(): boolean {
        return this._mature;
    }

    public get startedPromise(): Promise<void> {
        return this._startedPromise;
    }

    public get maturePromise(): Promise<void> {
        return this._maturePromise;
    }

    public constructor(startedPromise: Promise<void> | undefined) {
        if (startedPromise) {
            this._startedPromise = startedPromise;

            const matureDeferredPromise = new DeferredPromise();
            setTimeout(() => {
                this._mature = true;
                matureDeferredPromise.resolve();
            }, Timeouts.APP_MATURITY);

            this._maturePromise = matureDeferredPromise.promise;
        } else {
            this._startedPromise = Promise.resolve();
            this._maturePromise = Promise.resolve();
        }
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
}