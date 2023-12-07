import { IPartialTask, ITaskBuilder, TaskRun } from "./interfaces.ts";
import { getTasks } from "./task-collection.ts";
import { ArgumentException } from "../deps.ts";

export function task(task: IPartialTask): ITaskBuilder;
export function task(id: string, action: TaskRun): ITaskBuilder;
export function task(
    id: string,
    deps: string[],
    action?: TaskRun,
): ITaskBuilder;
export function task(id: string, name: string, action: TaskRun): ITaskBuilder;
export function task(
    id: string,
    name: string,
    deps: string[],
    action: TaskRun,
): ITaskBuilder;
export function task(): ITaskBuilder {
    const tasks = getTasks();
    const id = arguments[0] as string;
    let name = id;
    let deps: string[] = [];
    let action: TaskRun = () => Promise.resolve();
    const description: string | undefined = undefined;
    const timeout: number | undefined = undefined;

    switch (arguments.length) {
        case 1: {
            if (!(typeof arguments[0] === "object")) {
                throw new Error(`Excpected object for argument 'task'`);
            }

            const task = arguments[0] as IPartialTask;
            return tasks.add({
                id: task.id,
                name: task.name ?? task.id,
                description: task.description,
                deps: task.deps ?? [],
                timeout: task.timeout,
                run: task.run,
                force: task.force,
                skip: task.skip,
            });
        }

        case 2:
            {
                if (Array.isArray(arguments[1])) {
                    deps = arguments[1] as string[];
                } else if (typeof arguments[1] === "function") {
                    action = arguments[1] as TaskRun;
                } else {
                    throw new ArgumentException(
                        "action",
                        "Expected function for argument 'action'",
                    );
                }
            }
            break;

        case 3:
            {
                if (!(typeof arguments[2] === "function")) {
                    throw new Error(`Excpected string for argument 'name'`);
                }

                if (Array.isArray(arguments[1])) {
                    deps = arguments[1] as string[];
                } else {
                    name = arguments[1] as string;
                }

                action = arguments[2] as TaskRun;
            }
            break;

        case 4: {
            if (!(typeof arguments[1] === "string")) {
                throw new Error(`Excpected string for argument 'name'`);
            }

            if (!Array.isArray(arguments[2])) {
                throw new Error(`Excpected array for argument 'deps'`);
            }

            if (!(typeof arguments[3] === "function")) {
                throw new Error(`Excpected function for argument 'action'`);
            }

            name = arguments[1] as string;
            deps = arguments[2] as string[];
            action = arguments[3] as TaskRun;
        }
    }

    return tasks.add({
        id,
        name,
        deps,
        description,
        timeout,
        run: action,
    });
}
