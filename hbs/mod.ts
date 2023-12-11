import { handlebars } from "./deps.ts";
import { envHelpers } from "./env-helpers.ts";
import { stringHelpers } from "./string-helpers.ts";
import { typeHelpers } from "./type-helpers.ts";
import { compareHelpers } from "./compare-helpers.ts";
import { mathHelpers } from "./math.ts";

export { envHelpers, handlebars, stringHelpers, typeHelpers };

export const hbs = handlebars.create();

export function registerDefault(hb?: typeof handlebars) {
    registerHelpers(envHelpers, hb);
    registerHelpers(stringHelpers, hb);
    registerHelpers(typeHelpers, hb);
    registerHelpers(compareHelpers, hb);
    registerHelpers(mathHelpers, hb);
}

export function registerHelpers(helpers: Record<string, handlebars.HelperDelegate>, hb?: typeof handlebars) {
    if (hb) {
        for (const [k, v] of Object.entries(helpers)) {
            hb.registerHelper(k, v);
        }

        return;
    }

    for (const [k, v] of Object.entries(helpers)) {
        handlebars.registerHelper(k, v);
    }
}

registerDefault(hbs);
