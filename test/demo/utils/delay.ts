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
    WINDOW_REGISTRATION = 1000,
    // Certain events involve a handshake between client and service, but the API call is unawaited on the client, so we use this delay to
    // ensure the handshake has occured
    LISTENER_HANDSHAKE = 250
}
