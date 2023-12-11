# GnomeStack Fire Task Runner for Deno

Fire is a cli/remote task runner that runs tasks or jobs
from a yaml file. Jobs are a series of tasks that are run
in sequential order.  

Tasks are a unit of work that can have dependencies.

By default the fire cli looks for a fire.yaml or ./.fire/default.yaml
file that defines tasks and jobs.


## Install

Use deno to install the cli as a named script by
running `deno install --unstable -qAn qtr "https://deno.land/x/gs_fire@{VERSION}/cli.ts"`
where `{VERSION}` is a specific version number that has been released.

To install fire, run:

```bash
deno install --unstable -qAn fire "https://deno.land/x/gs_fire@{VERSION}/cli.ts"
```

To uninstall fire, run:

```bash
deno uninstall fire
```


## Cli Options

- **targets** An array of tasks or jobs to run
- **-e|--env**  Sets an environment variable. e.g. -e "KEY=VALUE"
- **-ef|--env-file** Sets an dotenv file to use
- **-l|--list** Lists the available tasks and jobs
  - **-l --task** Lists the available tasks
  - **-l --job** Lists the available jobs
- **--cwd** Sets the current working directory
- **-f|--fire-file** Sets the yaml file to use
- **-t|--time-out** Sets the timeout in milliseconds for everything to run
- **--job** Runs the jobs with ids that matches the targets
- **--task** Runs the tasks with ids that matches the targets.
- **--skip-needs** Skips running any dependent tasks or jobs.

## Vaults

Fire tasks supports pulling and creating secrets on the fly through
various vaults.  

The current vaults that are supported are: 'dotenv', 'sops', 'keepass'.

If the secret section exists, but the vault section does not exist, then 
`keepass` is used as the default vault and is stored under the os equivelant of
`${HOME}/.config/fire/default.kdbx`

### KeePass

The env variable `KEEPASS_PASSWORD` may be used to unlock the file.

```yaml
vault:
    # which vault type to use
    use: 'keepass' # 'dotenv' | 'sops' | 'keepass'
    # path to the keepass database. environment interpolation supported.
    uri: "${HOME}/.config/fire/default.kdbx"
    # creates the database if it does not exist
    create: true
    # the path to the file that contains the password
    passwordFile: "${HOME}/.config/fire/default.kdbx.password"
```

### DotEnv

Dot env files are not encrypted.

```yaml
vault:
    # which vault type to use
    use: 'dotenv' # 'dotenv' | 'sops' | 'keepass'
    # path to the keepass database. environment interpolation supported.
    uri: "${HOME}/.config/fire/secrets.env"
    # creates the database if it does not exist
    create: true
```

### Sops

The sops provider uses a dotenv file that is encrypted by SOPS. The
encrypted file may live in a github repository.  The provider does
currently support json or yaml files. The default sops provider
is `age`.

The dotenv file may be stored in source control.  The age key file
that holds the private key, **must never be stored in source control**.

```yaml
vault:
    # which vault type to use
    use: 'sops' # 'dotenv' | 'sops' | 'keepass'
    # path to the keepass database. environment interpolation supported.
    uri: "${HOME}/.config/fire/sops.env"
    # creates the database if it does not exist
    create: true

    # optional. defaults to age. 
    # the provider to use: 'aws' | 'gcp' | 'azure' | 'k8s' | 'age'
    provider: 'age'

    # optional. defaults to false
    # instructs the provider to use the sops environment variables:
    # see: https://github.com/getsops/sops?tab=readme-ov-file#encrypting-using-age
    # When this is used: ageKeyFile, ageRecipient, and ageRecipientFile are
    # ignored.
    useEnv: false
  
    # optional. defaults to the path below
    # the path to the age key (private) file. Used to decrypt.
    ageKeyFile: ${HOME}/.config/sops/age/keys.txt

    # optional. 
    # attemps to pull the public key from the ageKeyFile if not specificied.  
    # The recipent is the public key and is used to encrypt the file.
    ageRecipient: string
    # optional. the path to the file with the public key.
    ageRecipientFile: string
```

## Secrets

Secrets are pulled from a vault. So the yaml section requires a
key that acts as an environment variable name, a path for the vault
provider. 

```yaml
secrets:
  # The name of the secret as an environment variable.
  MSSQL_PASSWORD:
    # required.
    # the vault path used to pull the secret. the dots
    # are delimiters that are translated depending on the
    # vault implementation.  for dotenv files, the dots become '_'
    path: dev.mssql.password
    # optional. defaults to false. 
    # when true, the password will be generated if not found.
    create: true
    # optional. defaults to true. 
    # the length of the password to create.
    length: 16
    # optional. defaults to true.
    # include upper latin characters for password generation
    upper: true
    # optional. defaults to true.
    # include lower latin characters for password generation
    lower: true
    # optional. defaults to true
    # include 0-9.
    digits: true
    # optional. defaults to true.
    # special may be boolean or a string of characters to use
    special: "%$#@_-"

```
## Variables

Environment variables can be set in fire.yaml and may 
uses other variables to construct values.

```yaml
env:
  MY_VALUE: "test"
  MY_VALUE2: "${MY_VALUE}"

```


## Tasks

Tasks can be shared with jobs or executed as stand alone tasks. By default
the cli runner will execute stand alone tasks. 

```bash
# example is the name of the task to run
fire example
```

To set this explicitly use:
```bash
fire example --task
```

### Core Options

```yaml
tasks:
    # by defalut, the key here is used as the id of the task
    example: 
        # the id. this overwrites the yaml key. ids are what the
        # cli uses to invoke a task by name or what jobs use to 
        # reference a shared task
        id: whatever
        # name of the task. shows up in the cli when the task runs
        name: "Shell Example"

        # the envirionment variables passed to the tasks
        env:
            NAME: "{{ env.MY_VALUE }}"
            ANOTHER: "{{ secrets.MY_SECRET }}"
        
        # the description of the task. shows up in the cli
        description: "Runs an inline shell script"

        # optional. defaults to 0.
        # 0 or below is infinite. Otherwise timeout is in milliseconds
        timeout: 3500

        # optional. defaults to the current directory where the cli is.
        # sets the current working directory
        cwd: ./another directory

        # optional. defaults to true.
        # The task will runs only when the condition is met
        if: "{{ eq(env.OS, 'windows') }}"

        # optional. 
        # forces the task to run when a previous task fails.
        # useful for clean up tasks
        continueOnError: "true"

        # optional.
        # requires others tasks to run before this task whenever
        # this task is called. 
        needs: ["task1", "task2"]
```

### Shell Task

Runs an inline script as a task.

The shell task must have a 'run' block. The task supports the following
shells so long as they are installed on the operating system.

The shell defaults to `powershell` on windows and defaults to `bash`
on everything else.

allowed shells:
- bash
- sh
- pwsh
- powershell
- python
- ruby
- deno
- node
- dotnet-script

```yaml
tasks:
  shell_example:        
    # the inline script you want to run
    run: |
        echo "Hello World"
        
    # optional. defaults powershell on windows. bash on everything else
    shell: 'bash' 
```

### Docker

The docker task runs a command using an image. It will automatically pull
the image if it does not exist locally.

The `uses` block must start with `docker://` followed by the `[repo/]image[:tag]`

The docker task will create a mount bind volume using the 
current working directory to the `/opt/work` folder in the container.
then it will set the work directory for docker to `/opt/work`.

```yaml
tasks:
  ello:
    uses: docker://ubuntu:jammy
    with:
        # optional. 
        # the command / args to run on the container
        args: bash -c 'echo hello world && echo \"$PWD\" && ls -la'

        # optional.
        # 
        entrypoint: 

```

## Jobs

Jobs are a series of tasks run in sequential order similar to
a ci/cd pipeline. Jobs may use pre-defined tasks to share code.

When a task is run as a step of a job, the dependencies listed in the
task's `needs` field is ignored.

```bash
#  job1 is the name of the job to run
fire job1 --job
```

```yaml
tasks:
  ello:
    run: |
        console.log('ello');
    shell: deno

jobs:
  job2:
    steps:
      - run: | 
            Set-Content '{"test": "value"}' "./path/to/file.json
        shell: pwsh

  job1:
    needs: ["job2"]
    steps: 
      - ello
      - name: "ballon"
        run: |
            Get-Content "./path/to/file.json" -Raw
        shell: pwsh

```

## Notes

Handlbars is used to interpolate environment variables
and secrets in tasks fields.  This may be replaced in 
future with some kind of expressions parser. 

Release under MIT License