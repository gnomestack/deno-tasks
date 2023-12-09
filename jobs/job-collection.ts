import { ArgumentRangeException, InvalidOperationException } from "../deps.ts";
import { IMessageBus } from "../message-bus/mod.ts";
import { IFireJob } from "./types.ts";

export class JobCollection implements Iterable<IFireJob> {
    #jobs: IFireJob[] = [];
    #jobMap: Map<string, IFireJob> = new Map();

    get length() {
        return this.#jobs.length;
    }

    [Symbol.iterator](): Iterator<IFireJob> {
        return this.#jobs[Symbol.iterator]();
    }

    add(task: IFireJob) {
        if (task.id === "") {
            task.id = `task-${this.#jobs.length}`;
        }

        this.#jobs.push(task);
        this.#jobMap.set(task.id, task);
    }

    addRange(tasks: Iterable<IFireJob>) {
        for (const task of tasks) {
            this.add(task);
        }

        return this;
    }

    at(index: number): IFireJob {
        if (index < 0 || index >= this.#jobs.length) {
            throw new ArgumentRangeException(`Index out of range: ${index}`);
        }
        return this.#jobs[index];
    }

    clear() {
        this.#jobs = [];
        return this;
    }

    get(id: string): IFireJob | undefined {
        return this.#jobMap.get(id);
    }

    set(index: number, task: IFireJob) {
        if (index < 0 || index >= this.#jobs.length) {
            throw new ArgumentRangeException(`Index out of range: ${index}`);
        }
        if (task.id === "") {
            task.id = `job-${this.#jobs.length}`;
        }
        const i = this.#jobs.findIndex((t) => t.id === task.id);
        if (i === -1) {
            this.#jobMap.set(task.id, task);
        }
        this.#jobs[index] = task;
        return this;
    }

    remove(index: number) {
        if (index < 0 || index >= this.#jobs.length) {
            throw new ArgumentRangeException(`Index out of range: ${index}`);
        }
        const removed = this.#jobs.splice(index, 1);
        if (removed.length === 0) {
            return undefined;
        }

        this.#jobMap.delete(removed[0].id);
        return removed[0];
    }

    toArray(): IFireJob[] {
        return this.#jobs.concat([]);
    }
}

const g = globalThis as Record<string, unknown>;
g["globalFireJobs"] ??= new JobCollection();
export const jobs = g["globalFireJobs"] as JobCollection;

export function detectJobCycles(
    selected: IFireJob[],
    jobs: JobCollection,
    bus: IMessageBus,
) {
    const stack = new Set<string>();
    const resolve = (job: IFireJob) => {
        if (stack.has(job.id)) {
            const msg = `Cycle detected in task dependencies: ${[...stack.values(), job.id].join(" -> ")}`;
            const error = new InvalidOperationException(msg);
            bus.error(error);
            return false;
        }

        stack.add(job.id);
        if (job.needs?.length) {
            for (const dep of job.needs) {
                const depTask = jobs.get(dep);
                if (!depTask) {
                    const msg = `Dependency job '${dep}' not found for job '${job.name}'`;
                    const error = new InvalidOperationException(msg);
                    bus.error(error);
                    return false;
                }

                if (!resolve(depTask)) {
                    return false;
                }
            }
        }

        stack.delete(job.id);

        return true;
    };

    for (const job of selected) {
        if (!resolve(job)) {
            // cycle detected
            return true;
        }
    }

    // no cycles detected
    return false;
}

export function flattenJobs(
    selected: IFireJob[],
    jobs: JobCollection,
    bus: IMessageBus,
): { result: IFireJob[]; failed: boolean } {
    const result: IFireJob[] = [];

    // detect cycles
    for (const job of selected) {
        if (!job) {
            continue;
        }

        if (job.needs && job.needs.length > 0) {
            for (const dep of job.needs) {
                const depTask = jobs.get(dep);
                if (!depTask) {
                    const msg = `Dependency job '${dep}' not found for task '${job.name}'`;
                    const error = new InvalidOperationException(msg);
                    bus.error(error);
                    return { result, failed: true };
                }

                const depResult = flattenJobs([depTask], jobs, bus);
                if (depResult.failed) {
                    return depResult;
                }

                result.push(...depResult.result);
                if (!result.includes(depTask)) {
                    result.push(depTask);
                }
            }
        }

        if (!result.includes(job)) {
            result.push(job);
        }
    }

    return { result, failed: false };
}
