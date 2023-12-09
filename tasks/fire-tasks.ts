import { ResourceState } from "../execution/types.ts";
import { IFireTask, IFireTaskExecutionContext } from "./types.ts";

export abstract class FireTask implements IFireTask {
    id: string;

    name?: string;

    env: Record<string, string>;

    timeout?:
        | number
        | ((task: IFireTaskExecutionContext) => number)
        | ((task: IFireTaskExecutionContext) => Promise<number>);

    if?:
        | boolean
        | ((task: IFireTaskExecutionContext) => boolean)
        | ((task: IFireTaskExecutionContext) => Promise<boolean>);

    continueOnError?:
        | boolean
        | ((task: IFireTaskExecutionContext) => boolean)
        | ((task: IFireTaskExecutionContext) => Promise<boolean>);

    cwd?: string;

    description?: string;

    needs?: string[];

    constructor() {
        this.id = "";
        this.env = {};
    }
}

export abstract class ResourceTask extends FireTask {
    uses: string;

    with: Record<string, unknown>;

    state: ResourceState;

    constructor() {
        super();
        this.uses = "";
        this.with = {};
        this.state = "present";
    }
}

export abstract class PackageTask extends ResourceTask {
    packages: string[];

    constructor() {
        super();
        this.packages = [];
    }
}
