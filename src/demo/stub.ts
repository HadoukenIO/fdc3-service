// declare var window: Window & typeof globalThis & {fdc3?: typeof import('./main')};
// declare global {
//     interface Window {
//         fdc3?: typeof import('./main');
//     }
// }

type FDC3 = typeof import('../client/main');

const tmp: Window & {fdc3?: FDC3} = window;

export const fdc3: FDC3 = tmp.fdc3 || require('../client/main');

if (!tmp.fdc3) {
    tmp.fdc3 = fdc3;
}
