import { dotenv, fs } from "../deps.ts";
import { IExecutionContext } from "../execution/types.ts";
import { ISecretVault, IDotEnvOptions } from "./types.ts";

export class DotEnvVault implements ISecretVault 
{
    #options: IDotEnvOptions;
    #secrets: Record<string, string | undefined>;
    #loaded: boolean;
    #ctx: IExecutionContext

    constructor(options: IDotEnvOptions, ctx: IExecutionContext) {
        this.#options = options;
        this.#secrets = {};
        this.#loaded = false;
        this.#ctx = ctx;
    }

    get supportsSync() {
        return true
    }

    async getSecretValue(name: string): Promise<string | undefined> {
        const n = this.normalize(name);
        await this.load();
        return this.#secrets[n];
    }

    getSecretValueSync(name: string): string | undefined {
        this.loadSync();
        const n = this.normalize(name);
        return this.#secrets[n];
    }

    async setSecretValue(name: string, value: string): Promise<void> {
        await this.load();
        const n = this.normalize(name);
        this.#secrets[n] = value;
        await this.save();
    }

    setSecretValueSync(name: string, value: string): void {
        this.loadSync();
        const n = this.normalize(name);
        this.#secrets[n] = value;
        this.saveSync();
    }

    async deleteSecret(name: string): Promise<void> {
        await this.load();
        const n = this.normalize(name);
        delete this.#secrets[n];
        await this.save();
    }

    deleteSecretSync(name: string): void {
        this.loadSync();
        const n = this.normalize(name);
        delete this.#secrets[n];
        this.saveSync();
    }

    async listSecrets(): Promise<string[]> {
        await this.load();
        const keys : string[] = []
        for (const key of Object.keys(this.#secrets)) {
            if (this.#secrets[key] !== undefined) {
                keys.push(this.reverseNormalize(key));
            }
        }

        return keys;
    }

    listSecretsSync(): string[] {
        this.loadSync();
        const keys : string[] = []
        for (const key of Object.keys(this.#secrets)) {
            if (this.#secrets[key] !== undefined) {
                keys.push(this.reverseNormalize(key));
            }
        }

        return keys;
    }
    
    async save() {
        if (!this.#options.uri) {
            throw new Error("DotEnv uri not set");
        }

        const set :Record<string, string> = {};
        for (const key of Object.keys(this.#secrets)) {
            if (this.#secrets[key] !== undefined) {
               set[key] = this.#secrets[key] as string;
            }
        }

        const content = dotenv.stringify(set);
        await Deno.writeTextFile(this.#options.uri, content);
    }

    saveSync() {
        if (!this.#options.uri) {
            throw new Error("DotEnv uri not set");
        }

        const set :Record<string, string> = {};
        for (const key of Object.keys(this.#secrets)) {
            if (this.#secrets[key] !== undefined) {
               set[key] = this.#secrets[key] as string;
            }
        }

        const content = dotenv.stringify(set);
        Deno.writeTextFileSync(this.#options.uri, content);
    }

    

    async load() {
        if (this.#loaded) {
            return;
        }

        if (!this.#options.uri) {
            throw new Error("DotEnv uri not set");
        }

        if (!await fs.exists(this.#options.uri)) {
            if (this.#options.create) {
                await fs.ensureFile(this.#options.uri);
                this.#loaded = true;
                this.#secrets = {};
                return;
            }

            throw new Error(`DotEnv file ${this.#options.uri} not found`);
        }

        const content = await Deno.readTextFile(this.#options.uri);
        this.#secrets = dotenv.parse(content);
        this.#loaded = true;
    }

    loadSync() {
        if (this.#loaded) {
            return;
        }

        if (!this.#options.uri) {
            throw new Error("DotEnv uri not set");
        }

        const content = Deno.readTextFileSync(this.#options.uri);
        this.#secrets = dotenv.parse(content);
        this.#loaded = true;
    }

    reverseNormalize(name: string): string {
        return name.toLowerCase().replaceAll(/_|-/g, '.');
    }

    normalize(name: string): string {
        return name.toUpperCase().replaceAll(/-|\s|\./g, "_");
    }
}