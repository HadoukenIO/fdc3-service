import {DeferredPromise, allowReject} from 'openfin-service-async';

import {Application} from '../../client/directory';
import {Timeouts} from '../constants';

import {AppConnection} from './AppConnection';

/**
 * Represents a running application
 */
export class LiveApp {
    private readonly _connectionsById: Map<string, AppConnection> = new Map();
    private readonly _appInfoDeferredPromise: DeferredPromise<Application> = new DeferredPromise();

    private readonly _startedPromise: Promise<void>;
    private readonly _maturePromise: Promise<void>;

    private readonly _matureDeferredPromise: DeferredPromise<void> | undefined;

    private _appInfo: Application | undefined = undefined;
    private _appInfoFinal: boolean = false;

    private _started: boolean = false;
    private _mature: boolean = false;

    /**
     * Constructs a new LiveApp
     *
     * @param startedPromise A promise that resolves once the app fully started, or undefined if the app started "long ago" (e.g., was
     * running before the service started)
     */
    public constructor(startedPromise: Promise<void> | undefined) {
        if (startedPromise) {
            this._startedPromise = startedPromise;

            this._matureDeferredPromise = new DeferredPromise();

            startedPromise.then(() => {
                this._started = true;
                setTimeout(() => {
                    this._mature = true;
                    this._matureDeferredPromise!.resolve();
                }, Timeouts.APP_MATURITY);
            }, () => {
                this._appInfoDeferredPromise.reject(new Error('App failed to start'));
                this._matureDeferredPromise!.reject(new Error('App failed to start'));
            });

            this._maturePromise = allowReject(this._matureDeferredPromise.promise);
        } else {
            this._startedPromise = Promise.resolve();
            this._maturePromise = Promise.resolve();
        }
    }

    public get connections(): AppConnection[] {
        return Array.from(this._connectionsById.values());
    }

    public get appInfo(): Application | undefined {
        return this._appInfo;
    }

    public get started(): boolean {
        return this._started;
    }

    public get mature(): boolean {
        return this._mature;
    }

    public waitForAppStarted(): Promise<void> {
        return this._startedPromise;
    }

    public waitForAppMature(): Promise<void> {
        return this._maturePromise;
    }

    public waitForAppInfo(): Promise<Application> {
        return this._appInfoDeferredPromise.promise;
    }

    public hasFinalAppInfo(): boolean {
        return this._appInfoFinal || this._mature;
    }

    public setAppInfo(appInfo: Application, final: boolean): void {
        if ((this._appInfo === undefined) || (final && !this._appInfoFinal)) {
            this._appInfo = appInfo;
            this._appInfoDeferredPromise.resolve(appInfo);
            this._appInfoFinal = final;
        }
    }

    public addConnection(connection: AppConnection): void {
        this._connectionsById.set(connection.id, connection);
    }

    public removeConnection(connection: AppConnection): void {
        this._connectionsById.delete(connection.id);
    }

    public hasConnection(connection: AppConnection): boolean {
        return this._connectionsById.has(connection.id);
    }

    public setClosed(): void {
        this._appInfoDeferredPromise.reject(new Error('App closed before appInfo set'));
        if (this._matureDeferredPromise) {
            this._matureDeferredPromise.reject(new Error('App closed before mature'));
        }
    }
}
