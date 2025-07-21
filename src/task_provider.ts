import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const workspaceRoot = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
    ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
  if (!workspaceRoot) {
    return;
  }
  vscode.tasks.registerTaskProvider(JustTaskProvider.JustType, new JustTaskProvider(workspaceRoot));
}

export class JustTaskProvider implements vscode.TaskProvider {
  static JustType = 'just';
  private justPromise: Thenable<vscode.Task[]> | undefined = undefined;
  private flakeExists?: boolean;

  constructor(workspaceRoot: string) {
    const pattern = path.join(workspaceRoot, 'justfile');
    const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    fileWatcher.onDidChange(() => this.justPromise = undefined);
    fileWatcher.onDidCreate(() => this.justPromise = undefined);
    fileWatcher.onDidDelete(() => this.justPromise = undefined);
    flakeNixExists(workspaceRoot).then(x => this.flakeExists = x);
  }

  public provideTasks(): Thenable<vscode.Task[]> | undefined {
    if (!this.justPromise) {
      this.justPromise = getJustTasks();
    }
    return this.justPromise;
  }

  public resolveTask(_task: vscode.Task): vscode.Task | undefined {
    const taskName = _task.definition.task;
    if (taskName) {
      const definition = _task.definition;
      const commandLine = getCommandLine(definition.task, this.flakeExists ?? false);
      return new vscode.Task(definition, _task.scope ?? vscode.TaskScope.Workspace, definition.task, 'just', new vscode.ShellExecution(commandLine, { cwd: definition.dir }));
    }
    return undefined;
  }
}

function exec(command: string, options: cp.ExecOptions): Promise<{ stdout: string; stderr: string }> {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    cp.exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      }
      resolve({ stdout, stderr });
    });
  });
}

function getExecution(definition: JustTaskDefinition) {
  let baseCommand = getCommandLine(definition.task, definition.flakeExists);

  if (definition.promptForArgs) {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      const promptCmd = `$cmdargs = Read-Host 'Enter arguments for ${definition.task}'`;
      baseCommand = `${promptCmd}; ${baseCommand} $cmdargs`;
    } else {
      const promptCmd = `read -p "Enter arguments for ${definition.task}: " cmdargs`;
      baseCommand = `${promptCmd}; ${baseCommand} "$cmdargs"`;
    }
  }

  return new vscode.ShellExecution(baseCommand, { cwd: definition.dir });
}

function getCommandLine(taskName: string, flakeExists: boolean): string {
  const config = vscode.workspace.getConfiguration('just-recipe-runner');
  let useNix = config.get('useNix') as UseNix;
  if (useNix === UseNix.AUTO) {
    useNix = flakeExists ? UseNix.TRUE : UseNix.FALSE;
  }
  if (useNix === UseNix.TRUE) {
    return `/nix/var/nix/profiles/default/bin/nix develop --print-build-logs --command just ${taskName}`;
  }
  return `just ${taskName}`;
}

async function getJustTasks(): Promise<vscode.Task[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const result: vscode.Task[] = [];
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return result;
  }
  for (const workspaceFolder of workspaceFolders) {
    const folderString = workspaceFolder.uri.fsPath;
    if (!folderString) {
      continue;
    }
    const justfile = path.join(folderString, 'justfile');
    if (!fs.existsSync(justfile)) {
      continue;
    }

    const commandLine = 'just -l';
    try {
      const { stdout, stderr } = await exec(commandLine, { cwd: folderString });
      if (stderr && stderr.length > 0) {
        getOutputChannel().appendLine(stderr);
        getOutputChannel().show(true);
      }
      if (stdout) {
        const flakeExists = await flakeNixExists(workspaceFolder.uri.fsPath);

        const recipeLines = stdout.trim().split('\n').splice(1);
        for (const line of recipeLines) {
          const [recipeName, docComment] = line.split('#', 2);
          const parts = recipeName.trim().split(' ');
          const taskName = parts[0];
          const taskDetail = docComment?.trim();
          const definition: JustTaskDefinition = {
            type: 'just',
            task: taskName,
            dir: folderString,
            promptForArgs: parts.length > 1,
            flakeExists
          };
          const task = new vscode.Task(definition, workspaceFolder, taskName, 'just', getExecution(definition));
          task.detail = taskDetail;
          result.push(task);
        }
      }
    } catch (err: any) {
      const channel = getOutputChannel();
      if (err.stderr) {
        channel.appendLine(err.stderr);
      }
      if (err.stdout) {
        channel.appendLine(err.stdout);
      }
      channel.appendLine('Auto detecting just tasks failed.');
      channel.show(true);
    }
  }
  return result;
}

async function flakeNixExists(folder: string): Promise<boolean> {
  return await exists(path.join(folder, 'flake.nix'));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
    return true;
  } catch {
    return false;
  }
}

function getOutputChannel(): vscode.OutputChannel {
  if (!_channel) {
    _channel = vscode.window.createOutputChannel('just Auto Detection');
  }
  return _channel;
}

let _channel: vscode.OutputChannel;

interface JustTaskDefinition extends vscode.TaskDefinition {
  task: string;
  dir: string;
  promptForArgs: boolean;
  flakeExists: boolean;
}

enum UseNix {
  AUTO = 'auto',
  TRUE = 'yes',
  FALSE = 'no'
}