// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as temp from 'temp';
import * as child from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	vscode.languages.registerDocumentFormattingEditProvider({ scheme: "file", language: "verilog" }, {
		provideDocumentFormattingEdits: formatWithCharset
	});

}

// this method is called when your extension is deactivated
export function deactivate() { }

async function formatWithCharset(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
	var result = await vscode.window.showQuickPick(
		[
			"GBK",
			"UTF-8"
		],
		{
			canPickMany: false,
			ignoreFocusOut: true,
			matchOnDescription: true,
			matchOnDetail: true,
			placeHolder: "Choose the charset to format file"
		}
	).then(value => {
		return formatVerilog(document, value);
	});
	return result;
}

function formatVerilog(document: vscode.TextDocument, charset = "UTF-8"): vscode.TextEdit[] {
	let result: vscode.TextEdit[] = [];
	const verilogformat = <string>vscode.workspace.getConfiguration().get('verilog-format.path');
	const globalSettings = <string>vscode.workspace.getConfiguration().get('verilog-format.settings');

	if (!validFile(verilogformat)) {
		vscode.window.showErrorMessage('PATH ' + verilogformat + ' is not a executable legal format file, change settings verilog-format.path');
		return result;
	}

	var args: string[] = ["-f",];
	var tempfile: string = createTempFileOfDocument(document);
	args.push(tempfile);

	var hasSettingsFile: boolean = false;
	var settingFile: string = '';

	var localSettings = path.dirname(document.fileName)
		+ path.sep
		+ ".verilog-format.properties";

	if (validFile(localSettings)) {
		console.log('Local settings found');
		settingFile = localSettings;
		hasSettingsFile = true;
	} else if (validFile(globalSettings)) {
		console.log('Global settings found');
		settingFile = globalSettings;
		hasSettingsFile = true;
	}

	if (hasSettingsFile) {
		args.push("-s");
		args.push(settingFile);
	}

	args.push("-c");
	args.push(charset);

	try {
		console.log(`Executing command: "${verilogformat} ${args.join(" ")}"`);
		var execResult = child.spawnSync(verilogformat, args, {});
		var returnNumber = execResult.status;
		if (returnNumber === 0) {
			vscode.window.showInformationMessage("Format Success!");
		} else {
			vscode.window.showErrorMessage("Oops! Format seems to fail");
		}
		result = determineEdits(document, tempfile);
	} catch (err) {
		vscode.window.showErrorMessage(
			"Execute file not work, please check your settings verilog-format.path");
		console.log(err);
	}

	return result;
}

function createTempFileOfDocument(document: vscode.TextDocument): string {
	const content = document.getText();
	const tempfile = temp.openSync();
	if (tempfile === undefined) {
		throw new Error("Unable to create temporary file");
	}
	fs.writeSync(tempfile.fd, content);
	fs.closeSync(tempfile.fd);
	return tempfile.path;
}

function determineEdits(document: vscode.TextDocument, tempfile: string): vscode.TextEdit[] {
	const origContent = document.getText();
	const wholeFile = new vscode.Range(document.positionAt(0),
		document.positionAt(origContent.length));
	const formatted = fs.readFileSync(tempfile, { encoding: "utf8" });
	return [
		vscode.TextEdit.replace(wholeFile, formatted),
	];
}

function validFile(file: string): boolean {

	try {
		if (file === undefined) {
			return false;
		}

		if (file.length === 0) {
			return false;
		}

		if (fs.existsSync(file)) {
			return true;
		}
	} catch (err) {
		console.log(err);
	}

	return false;
}