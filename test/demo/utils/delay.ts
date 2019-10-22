/**
 * Returns a promise which resolves after a specificed period of time.
 * @param duration Time in milliseconds to wait before resolving
 */
export async function delay(duration: number) {
    return new Promise(res => {
        setTimeout(res, duration);
    });
}

export enum Duration {
    PAGE_RELOAD = 500,
    PAGE_NAVIGATE = 500,
    SHORTER_THAN_APP_MATURITY = 2500,
    LONGER_THAN_APP_MATURITY = 7500,
    // Should only be used when this isn't captured in the promise returned by a client-to-service API call
    SERVICE_TO_CLIENT_API_CALL = 100
}
