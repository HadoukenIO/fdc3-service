const MAX_PROMISE_CHAIN_LENGTH = 100;

const realDateNow = Date.now;
const boxedTime = {value: 0};

export function useFakeTime(): void {
    jest.useFakeTimers();
    boxedTime.value = 0;

    Date.now = () => {
        return boxedTime.value;
    };
}

export function useRealTime(): void {
    jest.useRealTimers();

    Date.now = realDateNow;
}

export function time(): number {
    return boxedTime.value;
}

export async function advanceTime(duration: number): Promise<void> {
    for (let i = 0; i < duration; i++) {
        for (let j = 0; j < MAX_PROMISE_CHAIN_LENGTH; j++) {
            await Promise.resolve();
        }
        boxedTime.value++;
        jest.advanceTimersByTime(1);
    }
}
