import { ITask, ITaskBuilder, ITaskCollection } from "./interfaces.ts";

export class TaskCollection implements ITaskCollection {
    #tasks: string[] = [];
    #map: Map<string, ITask> = new Map();

    get size(): number {
        return this.#tasks.length;
    }

    at(index: number): ITask {
        const id = this.#tasks[index];
        return this.#map.get(id)!;
    }
    add(task: ITask): ITaskBuilder {
        if (this.#map.has(task.id)) {
            throw new Error(`Task '${task.id}' already exists`);
        }

        this.#tasks.push(task.id);
        this.#map.set(task.id, task);
        return {
            description(description: string) {
                task.description = description;
                return this as ITaskBuilder;
            },
            deps(...deps: string[]) {
                task.deps.push(...deps);
                return this as ITaskBuilder;
            },
            name(name: string) {
                task.name = name;
                return this as ITaskBuilder;
            },
            timeout(timeout: number) {
                task.timeout = timeout;
                return this as ITaskBuilder;
            },
            skip(skip: boolean | (() => Promise<boolean>)) {
                task.skip = skip;
                return this as ITaskBuilder;
            },
            set(attributes: Partial<Omit<ITask, "id" | "run">>): ITaskBuilder {
                for (const key in attributes) {
                    if (key === "id" || key === "run") {
                        continue;
                    }

                    // deno-lint-ignore no-explicit-any
                    (task as any)[key] = (attributes as any)[key];
                }

                return this as ITaskBuilder;
            },
        };
    }

    get(id: string): ITask | undefined {
        return this.#map.get(id);
    }
    has(id: string): boolean {
        return this.#map.has(id);
    }
    addRange(tasks: Iterable<ITask>): void {
        for (const task of tasks) {
            this.add(task);
        }
    }

    toArray(): ITask[] {
        return this.#tasks.map((id) => this.#map.get(id)!);
    }

    [Symbol.iterator](): Iterator<ITask> {
        return this.#map.values();
    }
}

const g = globalThis as unknown as { tasks?: ITaskCollection };

export function getTasks(): ITaskCollection {
    g.tasks ??= new TaskCollection();
    return g.tasks!;
}

export function setTasks(tasks: ITaskCollection) {
    g.tasks = tasks;
}
