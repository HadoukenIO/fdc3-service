import {delay} from './delay';

const MAX_PROMISE_CHAIN_LENGTH = 100;

const realDateNow = Date.now;
let fakeTime = 0;
let usingFakeTime = false;

export function useFakeTime(): void {
    jest.useFakeTimers();

    Date.now = () => {
        return fakeTime;
    };

    fakeTime = 0;
    usingFakeTime = true;
}

export function useRealTime(): void {
    jest.useRealTimers();
    Date.now = realDateNow;

    usingFakeTime = false;
}

export async function advanceTime(duration: number): Promise<void> {
    if (usingFakeTime) {
        for (let i = 0; i < duration; i++) {
            for (let j = 0; j < MAX_PROMISE_CHAIN_LENGTH; j++) {
                await Promise.resolve();
            }
            fakeTime++;
            jest.advanceTimersByTime(1);
        }
    } else {
        delay(duration);
    }
}
