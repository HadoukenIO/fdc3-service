/**
 * Generates a random uuid based on math.random and the system time
 */
export function uuidv4() {
    return (Math.random().toString(36).substring(2) + Date.now().toString(36));
}
