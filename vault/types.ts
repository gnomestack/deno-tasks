
export interface IVaultOptions extends Record<string, unknown> {
    use: 'dotenv' | 'sops' | 'keepass'
    uri?: string
}

export interface IDotEnvOptions extends IVaultOptions {
    create?: boolean
}

export interface ISopsOptions extends IDotEnvOptions {
    ageKeyFile?: string
    ageRecipient?: string
    ageRecipientFile?: string
    provider?: 'aws' | 'gcp' | 'azure' | 'k8s' | 'age'
    create?: boolean
    useEnv?: boolean
}

export interface IKeepassOptions extends IDotEnvOptions {
    passwordFile?: string
    keyFile?: string
    create?: boolean
}

export interface ISecretVault {
    supportsSync: boolean

    getSecretValue(name: string): Promise<string | undefined>

    getSecretValueSync(name: string): string | undefined

    setSecretValue(name: string, value: string): Promise<void>

    setSecretValueSync(name: string, value: string): void

    deleteSecret(name: string): Promise<void>

    deleteSecretSync(name: string): void

    listSecrets(): Promise<string[]>

    listSecretsSync(): string[]
}