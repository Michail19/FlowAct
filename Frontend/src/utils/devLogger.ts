const isDev = import.meta.env.DEV;

export const devLogger = {
    log(...args: unknown[]) {
        if (isDev) {
            // eslint-disable-next-line no-console
            console.log(...args);
        }
    },

    warn(...args: unknown[]) {
        if (isDev) {
            // eslint-disable-next-line no-console
            console.warn(...args);
        }
    },

    error(...args: unknown[]) {
        if (isDev) {
            // eslint-disable-next-line no-console
            console.error(...args);
        }
    },
};
