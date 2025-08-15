import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  ErrorAction,
  CloseAction,
} from "vscode-languageclient/node";
import * as path from "path";
import * as fs from "fs";
import { JustLspInstaller } from "./just-lsp-installer";

function findExecutable(bin: string): string | null {
  const pathVar = process.env.PATH;
  if (!pathVar) {
    return null;
  }
  const pathParts = pathVar.split(path.delimiter);
  for (const p of pathParts) {
    const exe = path.join(p, bin);
    if (fs.existsSync(exe)) {
      return exe;
    }
  }
  return null;
}

// runs the justlsp binary
export async function createLanguageClient(
  context: vscode.ExtensionContext,
): Promise<LanguageClient | null> {
  const config = vscode.workspace.getConfiguration("justlang-lsp");
  const installer = new JustLspInstaller();

  // Try to detect just-lsp using the new installer system
  let serverPath = await installer.detectJustLsp();

  // If not found, prompt for installation
  if (!serverPath) {
    const shouldInstall = await installer.promptInstallation();
    if (shouldInstall) {
      // Try detection again after installation
      serverPath = await installer.detectJustLsp();
    }
  }

  if (!serverPath) {
    console.error(
      "[justlang-lsp] just-lsp binary not found after detection and installation attempts",
    );
    return null;
  }

  // Check if debug logging is enabled (force enable during tests)
  const isTestEnvironment =
    process.env.NODE_ENV === "test" || process.env.VSCODE_TEST === "1";
  const debugEnabled =
    isTestEnvironment || config.get<boolean>("debug.enabled", false);

  console.log(`[justlang-lsp] Found just-lsp executable at: ${serverPath}`);
  console.log("[justlang-lsp] Preparing to launch language server process...");

  // Prepare server arguments
  const args: string[] = [];

  // Add debug logging if enabled
  if (debugEnabled) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const logPath = path.join(workspaceRoot, "justlang_lsp.log");
      args.push("--log", logPath);
      console.log(
        `[justlang-lsp] Debug logging enabled, writing to: ${logPath}`,
      );
    } else {
      console.warn(
        "[justlang-lsp] Debug logging enabled but no workspace folder found",
      );
    }
  } else {
    console.log("[justlang-lsp] Debug logging disabled");
  }

  const serverOptions: ServerOptions = {
    command: serverPath,
    args: args,
    options: {
      env: process.env,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "just" }],
    outputChannelName: "Just Language Server",
    initializationOptions: {},
    // Enable all LSP capabilities
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        "**/*.{just,justfile,Justfile}",
      ),
    },
    // Enhanced error handling
    errorHandler: {
      error: (error, message, count) => {
        console.error(`[justlang-lsp] LSP Error (${count}):`, error, message);
        vscode.window.showErrorMessage(
          `Just LSP Error: ${error?.message || error}`,
        );

        // After 3 errors, try to restart
        if (count !== undefined && count >= 3) {
          console.warn("[justlang-lsp] Too many errors, attempting restart");
          return { action: ErrorAction.Shutdown };
        }
        return { action: ErrorAction.Continue };
      },
      closed: () => {
        console.warn("[justlang-lsp] LSP connection closed unexpectedly");
        vscode.window.showWarningMessage(
          "Just Language Server connection closed, attempting restart...",
        );
        return { action: CloseAction.Restart };
      },
    },
  };

  try {
    console.log("[justlang-lsp] Creating LanguageClient instance...");
    // console.log('[justlang-lsp] Server options:', JSON.stringify(serverOptions, null, 2));

    console.log(
      "[justlang-lsp] Client options:",
      JSON.stringify(clientOptions, null, 2),
    );

    const client = new LanguageClient(
      "justlang-lsp",
      "Just Language Server",
      serverOptions,
      clientOptions,
    );
    console.log("[justlang-lsp] LanguageClient instance created.");

    // Add event listeners for better debugging
    client.onDidChangeState((event) => {
      console.log(
        `[justlang-lsp] Client state changed: ${event.oldState} -> ${event.newState}`,
      );
    });

    client.onNotification("window/logMessage", (params) => {
      console.log(`[justlang-lsp] Server log: ${params.message}`);
    });

    client.onNotification("window/showMessage", (params) => {
      console.log(`[justlang-lsp] Server message: ${params.message}`);
    });

    // Monitor diagnostics to ensure they're being published
    client.onNotification("textDocument/publishDiagnostics", (params) => {
      console.log(
        `[justlang-lsp] Publishing diagnostics for ${params.uri}: ${params.diagnostics.length} issues`,
      );
      // Note: Removed automatic focus to Problems panel to prevent stealing focus while typing
    });

    // Handle server-to-client commands
    client.onRequest("workspace/executeCommand", async (params) => {
      console.log(
        `[justlang-lsp] Execute command request: ${params.command}`,
        params.arguments,
      );
      try {
        const result = await vscode.commands.executeCommand(
          params.command,
          ...(params.arguments || []),
        );
        return result;
      } catch (error) {
        console.error(`[justlang-lsp] Command execution failed:`, error);
        throw error;
      }
    });

    return client;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack =
      err instanceof Error ? err.stack : "No stack trace available";

    vscode.window.showErrorMessage(
      `Failed to create LanguageClient: ${errorMessage}`,
    );
    console.error("[justlang-lsp] Failed to create LanguageClient:", {
      message: errorMessage,
      stack: errorStack,
      serverOptions,
      clientOptions,
    });
    return null;
  }
}
