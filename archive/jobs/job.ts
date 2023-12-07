import { IJobBuilder, IPartialJob } from "./interfaces.ts";
import { getJobs } from "./job-collection.ts";
import { ArgumentException } from "../deps.ts";
import { TaskCollection } from "../tasks/task-collection.ts";

export function job(job: IPartialJob): IJobBuilder;
export function job(id: string): IJobBuilder;
export function job(id: string, deps: string[]): IJobBuilder;
export function job(id: string, name: string): IJobBuilder;
export function job(id: string, name: string, deps: string[]): IJobBuilder;
export function job(): IJobBuilder {
    const jobs = getJobs();
    const id = arguments[0] as string;
    let name = id;
    let deps: string[] = [];
    const description: string | undefined = undefined;
    const timeout: number | undefined = undefined;

    switch (arguments.length) {
        case 1:
            {
                if (typeof arguments[0] === "object") {
                    const job = arguments[0] as IPartialJob;
                    return jobs.add({
                        id: job.id,
                        tasks: new TaskCollection(),
                        name: job.name ?? job.id,
                        description: job.description,
                        deps: job.deps ?? [],
                        timeout: job.timeout,
                        force: job.force,
                        skip: job.skip,
                    });
                }

                if (typeof arguments[0] !== "string") {
                    throw new ArgumentException(
                        "id",
                        "Expected string for argument 'id' or object for argument 'job'",
                    );
                }
            }
            break;

        case 2:
            {
                if (Array.isArray(arguments[1])) {
                    deps = arguments[1] as string[];
                } else if (typeof arguments[1] === "string") {
                    name = arguments[1] as string;
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
                if (!Array.isArray(arguments[2])) {
                    throw new ArgumentException(
                        "deps",
                        "Expected array for argument 'deps'",
                    );
                }

                if (typeof arguments[1] !== "string") {
                    throw new ArgumentException(
                        "name",
                        "Expected string for argument 'name'",
                    );
                }

                name = arguments[1] as string;
                deps = arguments[2] as string[];
            }
            break;
    }

    return jobs.add({
        id,
        tasks: new TaskCollection(),
        name,
        deps,
        description,
        timeout,
    });
}
