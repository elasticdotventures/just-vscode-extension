
import * as vscode from 'vscode';

export type LogLevel = 'info' | 'warning' | 'error' | 'none';

class Logger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = 'info';

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Just');
        this.updateLogLevel();
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('justlang-lsp.logLevel')) {
                this.updateLogLevel();
            }
        });
    }

    private updateLogLevel() {
        const config = vscode.workspace.getConfiguration('justlang-lsp');
        this.logLevel = config.get<LogLevel>('logLevel', 'info');
    }

    private log(level: LogLevel, message: string, component?: string, data?: any) {
        if (this.logLevel === 'none') {
            return;
        }

        const levelValue = { 'info': 3, 'warning': 2, 'error': 1, 'none': 0 };
        if (levelValue[level] > levelValue[this.logLevel]) {
            return;
        }

        const timestamp = new Date().toISOString();
        const componentStr = component ? `[${component}] ` : '';
        const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
        this.outputChannel.appendLine(`[${timestamp}] [${level.toUpperCase()}] ${componentStr}${message}${dataStr}`);
    }

    info(message: string, component?: string, data?: any) {
        this.log('info', message, component, data);
    }

    warning(message: string, component?: string, data?: any) {
        this.log('warning', message, component, data);
    }

    error(message: string, component?: string, data?: any) {
        this.log('error', message, component, data);
    }

    errorFromException(error: unknown, message: string, component?: string) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.error(message, component, { error: errorMessage, stack });
    }
}

let logger: Logger | undefined;

export function getLogger(): Logger {
    if (!logger) {
        logger = new Logger();
    }
    return logger;
}
