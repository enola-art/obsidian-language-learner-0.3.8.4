const isDev = typeof process !== "undefined" && process.env?.NODE_ENV === "development";

export const logger = {
    log: (...args: unknown[]) => {
        if (isDev) console.log(...args);
    },
    warn: (...args: unknown[]) => {
        if (isDev) console.warn(...args);
    },
    error: (...args: unknown[]) => {
        console.error(...args);
    },
};
