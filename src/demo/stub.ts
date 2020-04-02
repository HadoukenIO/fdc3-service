type FDC3 = typeof import('../client/main');
const windowWithFDC3: Window & {fdc3?: FDC3} = window;

/**
 * Fetches the client library from the correct source.
 *
 * When using runtime injection: The runtime will inject a script that defines an `fdc3` global variable
 * When using desktop services: The client is imported, typically from an NPM module, but here directly from the source
 */
export const fdc3: FDC3 = windowWithFDC3.fdc3 || require('../client/main');

// Also attach the client to the window, if it isn't already
if (!windowWithFDC3.fdc3) {
    windowWithFDC3.fdc3 = fdc3;
}
