import { env } from "../deps.ts";

export const envHelpers = {
    "env-get": function (v: string) {
        return env.get(v);
    },

    "env-has": function (v: string) {
        return env.has(v);
    },

    "env-set": function (k: string, v: string) {
        env.set(k, v);
    },
};
