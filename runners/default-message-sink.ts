import { Message } from "./message-bus.ts";
import { blue, green, red, yellow } from "../deps.ts";
import {
    CommandMessage,
    TaskCancellationMessage,
    TaskEndMessage,
    TaskResultsMessage,
    TaskSkippedMessage,
    TaskStartMessage,
    TaskTimeoutMessage,
    UnhandledErrorMessage,
} from "./messages.ts";
import { getDebug, getHostWriter, getTasks, getVerbose } from "./globals.ts";
import { VERSION } from "../mod_info.ts";

export function writeVersion() {
    const hostWriter = getHostWriter();
    hostWriter.writeLine(VERSION);
}

export function listTasks() {
    const tasks = getTasks();
    const hostWriter = getHostWriter();
    hostWriter.writeLine(`TASKS:`);
    const maxTask = tasks
        .toArray()
        .map((t) => t.id.length)
        .reduce((a, b) => Math.max(a, b), 0);
    for (const task of tasks) {
        hostWriter.writeLine(`  ${task.id.padEnd(maxTask)}  ${task.description ?? ""}`);
    }
}

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

export function defaultMessageSink(message: Message): void {
    const hostWriter = getHostWriter();
    const supportsColor = hostWriter.settings.stdout &&
        hostWriter.settings.mode > 0;
    switch (message.kind) {
        case "task-start":
            {
                const msg = message as TaskStartMessage;
                hostWriter.startGroup(msg.task.name);
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

                hostWriter.writeLine();
                hostWriter.endGroup();
            }
            break;
        case "command":
            {
                const msg = message as CommandMessage;
                switch (msg.command) {
                    case "help":
                        writeHelp();
                        break;

                    case "list-tasks":
                        listTasks();
                        break;

                    case "version":
                        writeVersion();
                        break;
                }
            }
            break;
        case "unhandled-error":
            {
                const msg = message as UnhandledErrorMessage;
                if (getDebug() || getVerbose()) {
                    hostWriter.error(msg.error.stack ?? msg.error.message);
                } else {
                    hostWriter.error(msg.error.message);
                }
            }
            break;
        case "tasks-summary": {
            const msg = message as TaskResultsMessage;
            const maxTask = msg.taskResults.map((t) => t.task.name.length).reduce((a, b) => Math.max(a, b), 0);
            for (const result of msg.taskResults) {
                const task = result.task;
                let output: string;
                const duration = (result.end.getTime() - result.start.getTime()).toString();
                switch (result.status) {
                    case "ok":
                        {
                            if (supportsColor) {
                                output = `${task.name.padEnd(maxTask)} ${green("completed")} (${blue(duration)} ms)`;
                            } else {
                                output = `${task.name.padEnd(maxTask)} completed (${duration} ms)`;
                            }
                        }
                        break;

                    case "failed":
                        {
                            if (supportsColor) {
                                output = `${task.name.padEnd(maxTask)} ${red("failed")} (${blue(duration)} ms)`;
                            } else {
                                output = `${task.name.padEnd(maxTask)} failed (${duration} ms)`;
                            }
                        }
                        break;

                    case "timeout":
                        {
                            if (supportsColor) {
                                output = `${task.name.padEnd(maxTask)} ${red("timeout")} (${blue(duration)} ms)`;
                            } else {
                                output = `${task.name.padEnd(maxTask)} timeout (${duration} ms)`;
                            }
                        }

                        break;

                    case "skipped":
                        {
                            if (supportsColor) {
                                output = `${task.name.padEnd(maxTask)} ${yellow("skipped")} (${blue(duration)} ms)`;
                            } else {
                                output = `${task.name.padEnd(maxTask)} timeout (${duration} ms)`;
                            }
                        }
                        break;

                    case "cancelled":
                        {
                            if (supportsColor) {
                                output = `${task.name.padEnd(maxTask)} ${red("cancelled")} (${blue(duration)} ms)`;
                            } else {
                                output = `${task.name.padEnd(maxTask)} timeout (${duration} ms)`;
                            }
                        }
                        break;
                }

                hostWriter.writeLine(output);
            }
            break;
        }

        default:
            console.log(`Unknown message: ${message.kind}`);
            break;
    }
}
