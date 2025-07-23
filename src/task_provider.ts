import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';


export class JustTaskProvider implements vscode.TaskProvider {
  static JustType = 'just';
  private justPromise: Thenable<vscode.Task[]> | undefined = undefined;
  private flakeExists?: boolean;

  constructor(workspaceRoot: string) {
    const pattern = `{${workspaceRoot}/Justfile,${workspaceRoot}/.justfile,${workspaceRoot}/*.just}`;
    const fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    fileWatcher.onDidChange(() => this.justPromise = undefined);
    fileWatcher.onDidCreate(() => this.justPromise = undefined);
    fileWatcher.onDidDelete(() => this.justPromise = undefined);
    flakeNixExists(workspaceRoot).then(x => this.flakeExists = x);
  }

  public provideTasks(): Thenable<vscode.Task[]> | undefined {
    console.log(`[justlang-lsp debug] provideTasks() called`);
    if (!this.justPromise) {
      console.log(`[justlang-lsp debug] Creating new justPromise`);
      this.justPromise = getJustTasks();
    }
    this.justPromise.then(tasks => {
      console.log(`[justlang-lsp debug] *** FINAL RESULT: provideTasks() returning ${tasks.length} tasks ***`);
      tasks.forEach((task, index) => {
        console.log(`[justlang-lsp debug] Final Task[${index}]:`, {
          name: task.name,
          source: task.source,
          definition: JSON.stringify(task.definition),
          execution: task.execution?.constructor.name,
          scope: typeof task.scope === 'object' ? (task.scope as any).name : task.scope
        });
      });
      console.log(`[justlang-lsp debug] *** END FINAL RESULT ***`);
    }, err => {
      console.error(`[justlang-lsp debug] provideTasks() error:`, err);
    });
    return this.justPromise;
  }

  public resolveTask(_task: vscode.Task): vscode.Task | undefined {
    const taskName = _task.definition.task;
    if (taskName) {
      // resolveTask requires that the same definition object be used
      const definition: JustTaskDefinition = _task.definition as JustTaskDefinition;
      return new vscode.Task(
        definition,
        _task.scope ?? vscode.TaskScope.Workspace,
        definition.task,
        'just',
        new vscode.ShellExecution(`just ${definition.task}`, { cwd: definition.dir })
      );
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
    // DRY glob-based Justfile detection
    const glob = require('glob');
    const justfilePatterns = [
      'Justfile', '.justfile', '*.just', '*.justfile', 'justfile', '.Justfile', 'JUSTFILE'
    ];
    const foundJustfiles = justfilePatterns
      .map(pattern => glob.sync(pattern, { cwd: folderString, nocase: true }))
      .flat();
    console.log(`[justlang-lsp debug] Found Justfile candidates:`, foundJustfiles);
    if (!foundJustfiles.length) {
      continue;
    }

    const commandLine = 'just -l'; // Adjusted to support JustLang file formats
    try {
      console.log(`[justlang-lsp debug] Executing command: ${commandLine} in cwd: ${folderString}`);
      const { stdout, stderr } = await exec(commandLine, { cwd: folderString });
      console.log(`[justlang-lsp debug] just -l stdout:\n${stdout}`);
      console.log(`[justlang-lsp debug] just -l stderr:\n${stderr}`);
      if (stderr && stderr.length > 0) {
        getOutputChannel().appendLine(stderr);
        getOutputChannel().show(true);
      }
      if (stdout) {
        const flakeExists = await flakeNixExists(workspaceFolder.uri.fsPath);

        const recipeLines = stdout.trim().split('\n').splice(1);
        for (const line of recipeLines) {
          console.log('[justlang-lsp debug] Processing recipe line:', JSON.stringify(line));
          const [recipeName, docComment] = line.split('#', 2);
          console.log('[justlang-lsp debug] recipeName:', JSON.stringify(recipeName), 'docComment:', JSON.stringify(docComment));
          const parts = recipeName ? recipeName.trim().split(' ') : [];
          console.log('[justlang-lsp debug] parts:', JSON.stringify(parts));
          const taskName = parts[0];
          console.log('[justlang-lsp debug] taskName:', JSON.stringify(taskName));
          const taskDetail = docComment?.trim();
          
          // Create simple task definition following VSCode docs pattern
          const definition = {
            type: 'just',
            task: taskName,
            dir: folderString
          };
          
          // Create task following the official VSCode docs pattern exactly
          const task = new vscode.Task(
            definition,
            workspaceFolder,
            taskName,
            'just',
            new vscode.ShellExecution(`just ${taskName}`, { cwd: folderString })
          );
          
          // Set detail for documentation
          if (taskDetail) {
            task.detail = taskDetail;
          }
          
          // Only assign groups for specific well-known task names, following best practices
          if (taskName === 'build') {
            task.group = vscode.TaskGroup.Build;
          } else if (taskName === 'test') {
            task.group = vscode.TaskGroup.Test;
          } else if (taskName === 'clean') {
            task.group = vscode.TaskGroup.Clean;
          } else if (taskName === 'rebuild') {
            task.group = vscode.TaskGroup.Rebuild;
          }
          // For other tasks, don't assign a group - let them appear under the task type
          console.log(`[justlang-lsp debug] Creating task:`, {
            name: taskName,
            type: (task as any).definition?.type || 'unknown',
            detail: taskDetail,
            definition,
            definitionKeys: Object.keys(definition),
            taskType: (task as any).type,
            taskSource: (task as any).source
          });
          result.push(task);
        }
      }
    } catch (err: any) {
      console.error(`[justlang-lsp debug] Error executing just -l:`, err);
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
  console.log(`[justlang-lsp debug] getJustTasks() returning ${result.length} tasks total`);
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
  type: 'just';
  task: string;
  dir: string;
}

enum UseNix {
  AUTO = 'auto',
  TRUE = 'yes',
  FALSE = 'no'
}