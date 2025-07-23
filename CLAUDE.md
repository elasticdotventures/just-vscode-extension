

three repos are provided. 
justlang-lsp is the current target repo. it's an existing vscode extension for justlang offering *some* language functionality.   i.e. it should properly register the just language 

../just-lsp.subrepo is a rust lsp provider, the lsp provider is design for zed editor which also has LSP support but it has never been ported or tested wtih vscode. 

../vscode-languageserver-node-just is a heavily documented sample language service provider (code reference) 

use sequential thinking mcp tool and context7 to plan the integration of just-lsp.subrepo into justlang-lsp using the vscode-languageserver-node as a reference.

don't re-create files, it's better to copy files and the modify attribution in the header.

develop a plan, then send to orchestrator, use code agents.  instruct each code agent session to always run `just test` and validate the new behaviors. 

there is a custom packaging script scripts/package.js that is used to include files since we're using pnpm and vsce doesn't support that.

after reviewing the code make a step by step plan, start with making sure you have a plan for detecting if the rust-lsp binary is installed (and for installing it into the tests early, probably first thing)

change name from justlang-lsp.justlang-lsp to promptexecution.justlang-lsp


