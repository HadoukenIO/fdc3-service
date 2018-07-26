import {IApplication} from '../client/directory';

/**
 * Class that provides access to the application directory. Once retrieved, the results will be cached and then
 * updated periodically.
 *
 * This directory currently uses a local file as the application directory. Once fully developed, the application
 * directory will exist as a remote service.
 */
export class AppDirectory {
    /**
     * Temporary App Directory URL
     *
     * This URL is currently hard-coded but will eventually be defined in a place that can be controlled by the desktop owner.
     */
    private static URL: string = 'http://localhost:3012/demo/app-directory.json';

    /**
     * If cached application list is older than this duration, the next request to fetch the list of applications
     * will skip the cache and go to the API.
     */
    private static MAX_CACHE_AGE: number = 1000 * 60 * 60 * 24;  // 24 hours (in milliseconds)

    private applications: IApplication[];
    private timestamp: number;

    constructor() {
        this.applications = null;
        this.timestamp = 0;
    }

    /**
     * Returns a list of all applications in the directory.
     */
    public async getApplications(): Promise<IApplication[]> {
        if (this.applications && Date.now() < this.timestamp + AppDirectory.MAX_CACHE_AGE) {
            return this.applications;
        } else {
            return this.request();
        }
    }

    private async request(): Promise<IApplication[]> {
        return new Promise((resolve: (value: IApplication[]) => void, reject: (reason: Error) => void): void => {
            const xhr: XMLHttpRequest = new XMLHttpRequest();
            let response: IApplication[];

            xhr.open('GET', AppDirectory.URL);
            xhr.responseType = 'json';
            xhr.onreadystatechange = () => {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    if (xhr.status >= 200 && xhr.status < 400) {
                        response = xhr.response;

                        if (response && response instanceof Array) {
                            this.applications = response;
                            this.timestamp = Date.now();

                            resolve(this.applications);
                        } else {
                            reject(new Error('AppDirectory: Invalid content'));
                        }
                    } else {
                        reject(new Error('AppDirectory: Unexpected status (' + xhr.status + ')'));
                    }
                }
            };
            xhr.send();
        });
    }
}
