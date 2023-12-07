import {
    Consts,
    Credentials,
    env,
    fs,
    homeConfigDir,
    Kdbx,
    KdbxGroup,
    path,
    ProtectedValue,
    secretGenerator,
} from "../deps.ts";
import { equalsIgnoreCase } from "../deps.ts";

export class KpDatabase {
    #file: string;
    #db: Kdbx;

    constructor(file: string, db: Kdbx) {
        this.#file = file;
        this.#db = db;
    }

    get rootGroup() {
        return this.#db.getDefaultGroup();
    }

    get db() {
        return this.#db;
    }

    setSecret(path: string, value: string, delimiter = "/") {
        const entry = this.getEntry(path, delimiter);
        entry.fields.set("Password", value);
    }

    getEntry(path: string, delimiter = "/") {
        const segments = path.split(delimiter);
        const title = segments.pop();
        if (!title || title.length === 0) {
            throw new Error("entry title must not be empty");
        }
        let target: KdbxGroup = this.rootGroup;
        if (segments.length > 0) {
            target = this.getGroup(segments, delimiter);
        }

        let entry = target.entries.find((o) => {
            const t = o.fields.get("Title");
            let v = "";
            if (typeof t === "string") {
                v = t;
            } else if (t instanceof ProtectedValue) {
                v = t.getText();
            }

            return title === v;
        });

        if (!entry) {
            entry = this.#db.createEntry(target);
            entry.fields.set("Title", title);
        }

        return entry;
    }

    getGroup(path: string | string[], delimiter = "/") {
        let target = this.rootGroup;
        const segments = Array.isArray(path) ? path : path.split(delimiter);
        for (let i = 0; i < segments.length; i++) {
            const n = segments[i];
            let found = false;
            for (let j = 0; j < target.groups.length; j++) {
                const g = target.groups[j];
                if (g.name === n) {
                    target = g;
                    found = true;
                    break;
                }
            }

            if (!found) {
                const ng = this.#db.createGroup(target, n);
                target = ng;
            }
        }

        return target;
    }

    findGroup(path: string | string[], ignoreCase = false, delimiter = "/") {
        let target = this.rootGroup;
        const segments = Array.isArray(path) ? path : path.split(delimiter);
        for (let i = 0; i < segments.length; i++) {
            const n = segments[i];
            let found = false;
            for (let j = 0; j < target.groups.length; j++) {
                const g = target.groups[j];
                if ((ignoreCase && equalsIgnoreCase(g.name, n)) || g.name === n) {
                    target = g;
                    found = true;
                    break;
                }
            }

            if (!found) {
                return undefined;
            }
        }

        return target;
    }

    findEntry(path: string, ignoreCase = false, delimiter = "/") {
        const segments = path.split(delimiter);
        const title = segments.pop();
        let target: KdbxGroup | undefined = this.rootGroup;
        if (segments.length > 0) {
            target = this.findGroup(segments, ignoreCase);
            if (target === undefined) {
                return undefined;
            }
        }

        if (target === undefined) {
            return undefined;
        }

        return target.entries.find((o) => {
            const t = o.fields.get("Title");
            let v = "";
            if (typeof t === "string") {
                v = t;
            } else if (t instanceof ProtectedValue) {
                v = t.getText();
            }

            return (ignoreCase && equalsIgnoreCase(title, v)) || title === v;
        });
    }

    static async create(
        file: string,
        creds: Credentials,
        name?: string,
    ): Promise<KpDatabase> {
        name ??= path.basenameWithoutExtension(file);
        const dir = path.dirname(file);
        await fs.ensureDirectory(dir);
        const kdb = Kdbx.create(creds, name);
        kdb.setKdf(Consts.KdfId.Aes);
        const db = new KpDatabase(file, kdb);
        await db.save();
        return db;
    }

    static async open(file: string, creds: Credentials): Promise<KpDatabase> {
        const binaryDb = await fs.readFile(file);
        const existingDb = await Kdbx.load(binaryDb.buffer, creds);
        return new KpDatabase(file, existingDb);
    }

    async save() {
        const buffer = await this.#db.save();
        const dir = path.dirname(this.#file);
        await fs.ensureDirectory(dir);
        await fs.writeFile(this.#file, new Uint8Array(buffer));
    }
}

export async function getOrCreateKey() {
    if (env.get("KEEPASS_KEY")) {
        return { key: env.getRequired("KEEPASS_KEY") };
    }

    const dir = path.join(homeConfigDir(), "gnomestack", "vaults");
    await fs.ensureDirectory(dir);
    const keyFile = path.join(dir, "key.bin");

    if (await fs.exists(keyFile)) {
        const key2 = await fs.readFile(keyFile);
        return { key: key2, keyFile };
    }

    const key = secretGenerator.generateAsUint8Array(33);
    await fs.writeFile(keyFile, key);
    return { key, keyFile };
}

export function createCredentials(secret: string | Uint8Array) {
    if (typeof secret === "string") {
        return new Credentials(ProtectedValue.fromString(secret));
    }
    return new Credentials(ProtectedValue.fromBinary(secret));
}

export async function getOrCreateDevKdbx() {
    const locations = [
        env.get("DEV_KEEPASS"),
        env.get("OneDrive"),
        path.join(homeConfigDir(), "gnomestack"),
    ];

    const dir = locations.find((o) => o && o.length > 0);
    if (!dir) {
        throw new Error(`Directory not found for keepass`);
    }
    const kdbxFile = path.join(dir, "default.kdbx");

    const { key } = await getOrCreateKey();
    const credentials = createCredentials(key);
    if (await fs.exists(kdbxFile)) {
        return await KpDatabase.open(kdbxFile, credentials);
    }

    return await KpDatabase.create(kdbxFile, credentials);
}
