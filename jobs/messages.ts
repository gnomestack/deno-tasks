import { Message } from "../message-bus/mod.ts";
import { IJobResult } from "./types.ts";

export class JobSummaryMessage extends Message {
    constructor(public readonly jobResults: IJobResult[]) {
        super("jobs-summary");
    }
}
