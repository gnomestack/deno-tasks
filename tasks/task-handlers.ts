import { IFireTask } from "./types.ts";
import { FireTaskHandler } from "./types.ts";

export interface ITaskHandlerEntry {
    id: string;
    handler: FireTaskHandler;
    testTask: (task: IFireTask) => boolean;
    test: (model: Record<string, unknown>) => boolean;
    map: (model: Record<string, unknown>) => IFireTask;
}

const registry: Record<string, ITaskHandlerEntry> = {};

export function registerTaskHandler(
    id: string,
    test: (model: Record<string, unknown>) => boolean,
    testTask: (task: IFireTask) => boolean,
    handler: FireTaskHandler,
    map: (task: Record<string, unknown>) => IFireTask,
) {
    registry[id] = {
        id: id,
        test: test,
        testTask: testTask,
        handler: handler,
        map: map,
    };
}

export function getTaskHandlerEntry(id: string): ITaskHandlerEntry | undefined {
    return registry[id];
}

export function findTaskHandlerEntryByModel(
    model: Record<string, unknown>,
): ITaskHandlerEntry | undefined {
    for (const id in registry) {
        const entry = registry[id];
        if (entry.test(model)) {
            return entry;
        }
    }
    return undefined;
}

export function findTaskHandlerEntryByTask(task: IFireTask) {
    for (const id in registry) {
        const entry = registry[id];
        if (entry.testTask(task)) {
            return entry;
        }
    }
    return undefined;
}
