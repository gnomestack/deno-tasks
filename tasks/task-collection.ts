import { ArgumentRangeException, InvalidOperationException } from "../deps.ts";
import { IMessageBus } from "../message-bus/mod.ts";
import { IFireTask } from "./types.ts";

export class TaskCollection implements Iterable<IFireTask> {
    #tasks: IFireTask[] = [];
    #taskMap: Map<string, IFireTask> = new Map();

    get length() {
        return this.#tasks.length;
    }

    [Symbol.iterator](): Iterator<IFireTask> {
        return this.#tasks[Symbol.iterator]();
    }

    add(task: IFireTask) {
        if (task.id === "") {
            task.id = `task-${this.#tasks.length}`;
        }

        this.#tasks.push(task);
        this.#taskMap.set(task.id, task);
    }

    addRange(tasks: Iterable<IFireTask>) {
        for (const task of tasks) {
            this.add(task);
        }

        return this;
    }

    at(index: number): IFireTask {
        if (index < 0 || index >= this.#tasks.length) {
            throw new ArgumentRangeException(`Index out of range: ${index}`);
        }
        return this.#tasks[index];
    }

    get(id: string): IFireTask | undefined {
        return this.#taskMap.get(id);
    }

    clear() {
        this.#tasks = [];
        return this;
    }

    set(index: number, task: IFireTask) {
        if (index < 0 || index >= this.#tasks.length) {
            throw new ArgumentRangeException(`Index out of range: ${index}`);
        }
        if (task.id === "") {
            task.id = `task-${this.#tasks.length}`;
        }
        const i = this.#tasks.findIndex((t) => t.id === task.id);
        if (i === -1) {
            this.#taskMap.set(task.id, task);
        }
        this.#tasks[index] = task;
        return this;
    }

    remove(index: number) {
        if (index < 0 || index >= this.#tasks.length) {
            throw new ArgumentRangeException(`Index out of range: ${index}`);
        }
        const removed = this.#tasks.splice(index, 1);
        if (removed.length === 0) {
            return undefined;
        }

        this.#taskMap.delete(removed[0].id);
        return removed[0];
    }

    toArray(): IFireTask[] {
        return this.#tasks.concat([]);
    }
}

const g = globalThis as Record<string, unknown>;
g["fireTasks"] ??= new TaskCollection();
export const tasks = g["fireTasks"] as TaskCollection;

export function detectTaskCycles(
    selected: IFireTask[],
    tasks: TaskCollection,
    bus: IMessageBus,
) {
    const stack = new Set<string>();
    const resolve = (task: IFireTask) => {
        if (stack.has(task.id)) {
            const msg = `Cycle detected in task dependencies: ${[...stack.values(), task.id].join(" -> ")}`;
            const error = new InvalidOperationException(msg);
            bus.error(error);
            return false;
        }

        stack.add(task.id);
        if (task.needs?.length) {
            for (const dep of task.needs) {
                const depTask = tasks.get(dep);
                if (!depTask) {
                    const msg = `Dependency task '${dep}' not found for task '${task.name}'`;
                    const error = new InvalidOperationException(msg);
                    bus.error(error);
                    return false;
                }

                if (!resolve(depTask)) {
                    return false;
                }
            }
        }

        stack.delete(task.id);

        return true;
    };

    for (const task of selected) {
        if (!resolve(task)) {
            // cycle detected
            return true;
        }
    }

    // no cycles detected
    return false;
}

export function flattenTasks(
    selected: IFireTask[],
    tasks: TaskCollection,
    bus: IMessageBus,
): { result: IFireTask[]; failed: boolean } {
    const result: IFireTask[] = [];

    // detect cycles
    for (const task of selected) {
        if (!task) {
            continue;
        }

        if (task.needs) {
            for (const dep of task.needs) {
                const depTask = tasks.get(dep);
                if (!depTask) {
                    const msg = `Dependency task '${dep}' not found for task '${task.name}'`;
                    const error = new InvalidOperationException(msg);
                    bus.error(error);
                    return { result, failed: true };
                }

                const depResult = flattenTasks([depTask], tasks, bus);
                if (depResult.failed) {
                    return depResult;
                }

                result.push(...depResult.result);
                if (!result.includes(depTask)) {
                    result.push(depTask);
                }
            }
        }

        if (!result.includes(task)) {
            result.push(task);
        }
    }

    return { result, failed: false };
}
