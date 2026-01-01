#!/usr/bin/env node
import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const SUBCOMMANDS = {
	debugger: {
		root: 'src/asset_debugger',
		description: '3D asset debugger with drag-and-drop interface'
	}
};

function printHelp() {
	console.log(`
blorktools - 3D Asset Development Tools

Usage: blorktools [command] [options]

Commands:
  (none)      Open the tools index page
  debugger    Open the asset debugger directly

Options:
  --port, -p <number>  Port to run on (default: 3001)
  --host, -h <string>  Host to bind to (default: localhost)
  --no-open            Don't open browser automatically
  --help               Show this help message
`);
}

function parseArgs(args) {
	const result = {
		command: null,
		port: 3001,
		host: 'localhost',
		open: true
	};
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === '--port' || arg === '-p') {
			const value = parseInt(args[++i], 10);
			if (isNaN(value)) {
				console.error('Error: --port requires a numeric value');
				process.exit(1);
			}
			result.port = value;
		} else if (arg === '--host' || arg === '-h') {
			result.host = args[++i];
			if (!result.host) {
				console.error('Error: --host requires a value');
				process.exit(1);
			}
		} else if (arg === '--no-open') {
			result.open = false;
		} else if (arg === '--help') {
			printHelp();
			process.exit(0);
		} else if (!arg.startsWith('-')) {
			if (SUBCOMMANDS[arg]) {
				result.command = arg;
			} else {
				console.error(`Error: Unknown command "${arg}"`);
				console.error('Run "blorktools --help" for available commands');
				process.exit(1);
			}
		}
	}
	return result;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const subcommand = args.command ? SUBCOMMANDS[args.command] : null;
	const rootDir = subcommand ? path.join(packageRoot, subcommand.root) : path.join(packageRoot, 'src');
	const viteConfig = await import(path.join(packageRoot, 'vite.config.js'));
	const config = viteConfig.default;
	config.server = {
		...config.server,
		port: args.port,
		host: args.host,
		open: args.open ? '/index.html' : false
	};
	config.root = rootDir;
	const server = await createServer(config);
	await server.listen();
	server.printUrls();
	console.log('\nPress Ctrl+C to stop\n');
}

main();
