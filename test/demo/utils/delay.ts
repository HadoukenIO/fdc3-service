/**
 * Returns a promise which resolves after a specificed period of time.
 * @param duration Time in milliseconds to wait before resolving
 */
export async function delay(duration: number) {
    return new Promise((res) => {
        setTimeout(res, duration);
    });
}

export enum Duration {
    PAGE_RELOAD = 500,
    PAGE_NAVIGATE = 500,
    SHORTER_THAN_APP_MATURITY = 2000,
    LONGER_THAN_APP_MATURITY = 6000,
    LONGER_THAN_SERVICE_TO_CLIENT_API_CALL_TIMEOUT = 6000,
    // Should only be used when this isn't captured in the promise returned by an API call, or we have good reason to not await the API call
    API_CALL = 250,
    WINDOW_REGISTRATION = 1000
}
