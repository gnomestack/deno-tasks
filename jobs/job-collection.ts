import { IJob, IJobBuilder, IJobCollection } from "./interfaces.ts";

export class JobCollection implements IJobCollection {
    #tasks: string[] = [];
    #map: Map<string, IJob> = new Map();

    get size(): number {
        return this.#tasks.length;
    }

    at(index: number): IJob {
        const id = this.#tasks[index];
        return this.#map.get(id)!;
    }
    add(task: IJob): IJobBuilder {
        if (this.#map.has(task.id)) {
            throw new Error(`Task '${task.id}' already exists`);
        }

        this.#tasks.push(task.id);
        this.#map.set(task.id, task);
        return {
            description(description: string) {
                task.description = description;
                return this as IJobBuilder;
            },
            deps(...deps: string[]) {
                task.deps.push(...deps);
                return this as IJobBuilder;
            },
            name(name: string) {
                task.name = name;
                return this as IJobBuilder;
            },
            timeout(timeout: number) {
                task.timeout = timeout;
                return this as IJobBuilder;
            },
            skip(skip: boolean | (() => Promise<boolean>)) {
                task.skip = skip;
                return this as IJobBuilder;
            },
            set(attributes: Partial<Omit<IJob, "id" | "run">>): IJobBuilder {
                for (const key in attributes) {
                    if (key === "id" || key === "run") {
                        continue;
                    }

                    // deno-lint-ignore no-explicit-any
                    (task as any)[key] = (attributes as any)[key];
                }

                return this as IJobBuilder;
            },
        };
    }

    get(id: string): IJob | undefined {
        return this.#map.get(id);
    }
    has(id: string): boolean {
        return this.#map.has(id);
    }
    addRange(tasks: Iterable<IJob>): void {
        for (const task of tasks) {
            this.add(task);
        }
    }

    toArray(): IJob[] {
        return this.#tasks.map((id) => this.#map.get(id)!);
    }

    [Symbol.iterator](): Iterator<IJob> {
        return this.#map.values();
    }
}

const g = globalThis as unknown as { tasks?: IJobCollection };

export function getJobs(): IJobCollection {
    g.tasks ??= new JobCollection();
    return g.tasks!;
}

export function setJobs(tasks: IJobCollection) {
    g.tasks = tasks;
}
