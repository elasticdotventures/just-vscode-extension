
import * as vscode from 'vscode';
import * as os from 'os';
import { getLogger } from './logger';

const logger = getLogger();

export interface TerminalOptions {
    command: string;
    args: string[];
    cwd: string;
    terminalName: string;
    reuseTerminal: boolean;
    showTerminal: boolean;
}

class TerminalManager {
    private terminals: Map<string, vscode.Terminal> = new Map();

    constructor() {
        vscode.window.onDidCloseTerminal(terminal => {
            this.terminals.forEach((t, name) => {
                if (t === terminal) {
                    this.terminals.delete(name);
                    logger.info(`Terminal closed: ${name}`, 'TerminalManager');
                }
            });
        });
    }

    public async execute(options: TerminalOptions): Promise<void> {
        try {
            const terminal = this.getOrCreateTerminal(options);
            const shellCommand = this.getShellCommand();

            if (options.showTerminal) {
                terminal.show();
            }

            const commandParts = [options.command, ...options.args];
            const fullCommand = shellCommand.length > 0 
                ? [...shellCommand, commandParts.join(' ')].join(' ')
                : commandParts.join(' ');

            terminal.sendText(fullCommand, true);
            logger.info(`Executing command in terminal '${options.terminalName}'`, 'TerminalManager', { command: fullCommand });

        } catch (error) {
            logger.errorFromException(error, 'Terminal execution failed');
            throw error;
        }
    }

    private getOrCreateTerminal(options: TerminalOptions): vscode.Terminal {
        if (options.reuseTerminal && this.terminals.has(options.terminalName)) {
            const existingTerminal = this.terminals.get(options.terminalName);
            if (existingTerminal) {
                logger.info(`Reusing terminal: ${options.terminalName}`, 'TerminalManager');
                // Check if the terminal's underlying process is still alive
                if (existingTerminal.exitStatus === undefined) {
                    return existingTerminal;
                }
                logger.warning(`Terminal '${options.terminalName}' had exited. Creating a new one.`, 'TerminalManager');
                this.terminals.delete(options.terminalName);
            }
        }

        const terminalOptions: vscode.TerminalOptions = {
            name: options.terminalName,
            cwd: options.cwd,
            shellPath: this.getShellPath(),
        };

        const newTerminal = vscode.window.createTerminal(terminalOptions);
        this.terminals.set(options.terminalName, newTerminal);
        logger.info(`Created new terminal: ${options.terminalName}`, 'TerminalManager', { options: terminalOptions });
        return newTerminal;
    }

    private getShellPath(): string | undefined {
        const shell = this.getShellCommand();
        return shell.length > 0 ? shell[0] : undefined;
    }

    private getShellCommand(): string[] {
        const config = vscode.workspace.getConfiguration('justlang-lsp');
        const isWindows = os.platform() === 'win32';

        if (isWindows) {
            const windowsShell = config.get<string[]>('windowsShell', []);
            if (windowsShell.length > 0) {
                logger.info(`Using custom Windows shell: ${windowsShell.join(' ')}`, 'TerminalManager');
                return windowsShell;
            }
            logger.info('Using default Windows shell (powershell.exe)', 'TerminalManager');
            return ['powershell.exe', '-Command'];
        }

        // Unix-like systems
        const shell = config.get<string[]>('shell', []);
        if (shell.length > 0) {
            logger.info(`Using custom shell: ${shell.join(' ')}`, 'TerminalManager');
            return shell;
        }
        logger.info('Using default shell (bash)', 'TerminalManager');
        return ['bash', '-c'];
    }
}

let terminalManager: TerminalManager | undefined;

export function getTerminalManager(): TerminalManager {
    if (!terminalManager) {
        terminalManager = new TerminalManager();
    }
    return terminalManager;
}
