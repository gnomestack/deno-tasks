import { GroupStartMessage, Message } from "./../message-bus/mod.ts";
import { ansiWriter, blue, green, magenta, red, yellow } from "../deps.ts";
import {
    TaskCancellationMessage,
    TaskSkippedMessage,
    TaskStartMessage,
    TaskSummaryMessage,
    TaskTimeoutMessage,
} from "../tasks/messages.ts";
import {
    DebugMessage,
    ErrorMessage,
    InfoMessage,
    TraceMessage,
    UnhandledErrorMessage,
    WarnMessage,
} from "../message-bus/mod.ts";
import { getDebug, getHostWriter, getTrace } from "./globals.ts";
import { VERSION } from "../mod-info.ts";
import { TaskCollection } from "../tasks/task-collection.ts";
import { JobCollection } from "../jobs/job-collection.ts";
import { CommandMessage, ListJobMessage, ListMessage, ListTaskMessage } from "./messages.ts";
import { ITaskResult } from "../tasks/types.ts";
import { JobSummaryMessage } from "../jobs/messages.ts";
import { IJobResult } from "../jobs/types.ts";

export function writeVersion() {
    const hostWriter = getHostWriter();
    hostWriter.writeLine(VERSION);
}

export function listTasks(tasks: TaskCollection) {
    const hostWriter = getHostWriter();
    const maxTask = tasks
        .toArray()
        .map((t) => t.id.length)
        .reduce((a, b) => Math.max(a, b), 0);
    for (const task of tasks) {
        hostWriter.writeLine(
            `${task.id.padEnd(maxTask)}  ${task.description ?? ""}`,
        );
    }
}

export function listJobs(jobs: JobCollection) {
    const hostWriter = getHostWriter();
    const maxTask = jobs
        .toArray()
        .map((t) => t.id.length)
        .reduce((a, b) => Math.max(a, b), 0);
    for (const job of jobs) {
        hostWriter.writeLine(
            `${job.id.padEnd(maxTask)}  ${job.description ?? ""}`,
        );
    }
}

/*
function writeHelp() {
    const tasks = getTasks();
    const hostWriter = getHostWriter();
    hostWriter.writeLine(`Quasar Task Runner version ${VERSION}

USAGE:
    qtr [...TASK] [OPTIONS]

OPTIONS:
    -h|--help                  Print the help information
    -s|--skip-deps             Skips all task dependencies
    -t|--timeout               The timeout in seconds for the task runner to complete
    -e|--env                   Set an environment variable .e.g. -e FOO="bar"
    -l|--list                  List all available tasks
    -v|--version               Print the version of the task runner.
    --ef|--env-file            Set an environment variable from a file .e.g. -ef .env
    --tf|--task-file           Set the task file to use. Defaults to
                               ./quasar_tasks.ts or ./.quasar/tasks.ts
    --wd|--working-directory   Sets the working directory.
    --debug                    Sets the debug flag

`);
    if (tasks.size > 0) {
        listTasks();
    }
}
*/

export function consoleSink(message: Message): void {
    const hostWriter = getHostWriter();
    const supportsColor = hostWriter.settings.stdout &&
        hostWriter.settings.mode > 0;
    switch (message.kind) {
        case "group-start":
            {
                const msg = message as GroupStartMessage;
                hostWriter.startGroup(msg.groupName);
            }
            break;

        case "group-end":
            {
                hostWriter.endGroup();
            }
            break;
        case "debug":
            {
                const msg = message as DebugMessage;
                if (getDebug()) {
                    hostWriter.debug(msg.message);
                }
            }
            break;

        case "info":
            {
                const msg = message as InfoMessage;
                hostWriter.info(msg.message);
            }
            break;

        case "trace":
            {
                if (getTrace()) {
                    const msg = message as TraceMessage;
                    hostWriter.trace(msg.message);
                }
            }
            break;

        case "warn":
            {
                const msg = message as WarnMessage;
                hostWriter.writeLine(yellow(msg.message));
            }
            break;
        case "task-start":
            {
                const msg = message as TaskStartMessage;
                const task = msg.task;
                const name = task.name ?? task.id;
                hostWriter.startGroup(name);
            }
            break;
        case "task-skipped":
            {
                const msg = message as TaskSkippedMessage;
                hostWriter.startGroup(`${msg.taskResult.task.name} (skipped)`);
                hostWriter.endGroup();
            }
            break;
        case "task-timeout":
            {
                const msg = message as TaskTimeoutMessage;
                const output =
                    `Task ${msg.taskResult.task.name} timed out after ${msg.taskResult.task.timeout} seconds.`;
                hostWriter.writeLine(supportsColor ? red(output) : output);
                hostWriter.endGroup();
            }
            break;
        case "task-cancelled":
            {
                const msg = message as TaskCancellationMessage;
                const output = `Task ${msg.taskResult.task.name} cancelled.`;
                hostWriter.writeLine(supportsColor ? yellow(output) : output);
                hostWriter.endGroup();
            }
            break;
        case "task-end":
            {
                /*
                const msg = message as TaskEndMessage;
                if (msg.taskResult.status === "ok") {
                    const output = `Task ${msg.taskResult.task.name} completed successfully.`;
                    hostWriter.write(supportsColor ? green(output) : output);
                }
                if (msg.taskResult.status === "failed") {
                    const e = msg.taskResult.e;
                    if (e instanceof Error) {
                        hostWriter.error(e);
                    } else {
                        hostWriter.error(msg.taskResult.e?.toString() ?? "Unknown error");
                    }

                    const output = `Task ${msg.taskResult.task.name} failed.`;
                    hostWriter.error(supportsColor ? red(output) : output);
                }
                */

                hostWriter.writeLine();
                hostWriter.endGroup();
            }
            break;
        case "command":
            {
                const msg = message as CommandMessage;
                switch (msg.command) {
                    case "list-tasks":
                        {
                            const listTaskMessage = message as ListTaskMessage;
                            listTasks(listTaskMessage.tasks);
                        }
                        break;

                    case "list-jobs":
                        {
                            const listJobMessage = message as ListJobMessage;
                            listJobs(listJobMessage.jobs);
                        }
                        break;

                    case "list":
                        {
                            const listMessage = message as ListMessage;
                            ansiWriter.writeLine(blue("> jobs"));
                            listJobs(listMessage.jobs);
                            ansiWriter.writeLine()
                            ansiWriter.writeLine(blue("> tasks"));
                            listTasks(listMessage.tasks);
                        }
                        break;

                    case "version":
                        writeVersion();
                        break;
                }
            }
            break;
        case "error":
            {
                const msg = message as ErrorMessage;
                let error: Error | undefined = undefined;
                if (msg.error instanceof Error) {
                    error = msg.error;
                }

                if (error) {
                    if (error.stack) {
                        hostWriter.writeLine(red(error.stack));
                    } else {
                        hostWriter.writeLine(red(error.toString()));
                    }

                    // TODO: fix
                    // hostWriter.error(error, "");
                } else {
                    if (msg.error === undefined || msg.error === null) {
                        hostWriter.writeLine(red("Unknown error. No error message provided."));
                    } else {
                        hostWriter.writeLine(red(msg.error.toString()));
                    }
                }
            }
            break;
        case "unhandled-error":
            {
                const msg = message as UnhandledErrorMessage;
                hostWriter.writeLine(red(msg.error.toString()));
            }
            break;
        case "tasks-summary":
            {
                const msg = message as TaskSummaryMessage;
                writeTasksSummary(msg.taskResults);
            }
            break;

        case "jobs-summary":
            {
                const msg = message as JobSummaryMessage;
                for (const jobResult of msg.jobResults) {
                    writeJobSummary(jobResult);
                }
            }
            break;

        default:
            console.log(`Unknown message: ${message.kind}`);
            break;
    }
}

function writeJobSummary(jobResult: IJobResult) {
    ansiWriter.writeLine();
    const name = jobResult.job.name ?? jobResult.job.id;
    switch (jobResult.status) {
        case "completed":
            {
                ansiWriter.writeLine(`Job ${magenta(name)} ${green("completed")}`);
            }
            break;

        case "failed":
            {
                ansiWriter.writeLine(`Job ${magenta(name)} ${red("failed")}`);
            }
            break;

        case "cancelled":
            {
                ansiWriter.writeLine(`Job ${magenta(name)} ${red("timeout")}`);
            }
            break;

        case "skipped":
            {
                ansiWriter.writeLine(`Job ${magenta(name)} ${yellow("skipped")}`);
            }
            break;
    }
    ansiWriter.writeLine("-----------------------------");
    writeTasksSummary(jobResult.taskResults);
}

function writeTasksSummary(taskResults: ITaskResult[]) {
    const maxTask = taskResults.map((r) => (r.task.name ?? r.task.id).length).reduce(
        (a, b) => Math.max(a, b),
        0,
    );
    for (const result of taskResults) {
        const task = result.task;
        let output = "";
        const duration = (result.endAt.getTime() - result.startAt.getTime())
            .toString();
        const name = task.name ?? task.id;
        switch (result.status) {
            case "completed":
                {
                    output = `${name.padEnd(maxTask)} ${green("completed")} (${blue(duration)} ms)`;
                }
                break;

            case "failed":
                {
                    output = `${name.padEnd(maxTask)} ${red("failed")} (${blue(duration)} ms)`;
                }
                break;

            case "cancelled":
                {
                    output = `${name.padEnd(maxTask)} ${red("timeout")} (${blue(duration)} ms)`;
                }

                break;

            case "skipped":
                {
                    output = `${name.padEnd(maxTask)} ${yellow("skipped")} (${blue(duration)} ms)`;
                }
                break;
        }

        ansiWriter.writeLine(output);
    }
}
