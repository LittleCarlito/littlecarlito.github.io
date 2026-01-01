import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function gracefulShutdownPlugin() {
	return {
		name: 'graceful-shutdown',
		configureServer(server) {
			const shutdown = () => {
				server.close();
				process.exit(0);
			};
			process.on('SIGINT', shutdown);
			process.on('SIGTERM', shutdown);
		}
	};
}

export default defineConfig({
	root: path.resolve(__dirname, 'src'),
	build: {
		lib: {
			entry: path.resolve(__dirname, 'src/index.js'),
			name: 'blorktools',
			fileName: 'index'
		},
		outDir: path.resolve(__dirname, 'dist'),
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			external: ['three', 'jszip'],
			output: {
				globals: {
					three: 'THREE',
					jszip: 'JSZip'
				}
			}
		}
	},
	server: {
		open: '/index.html',
		port: 3001,
		strictPort: true,
		allowedHosts: true,
		fs: {
			allow: [__dirname]
		},
		middlewareMode: false
	},
	plugins: [
		gracefulShutdownPlugin()
	],
	optimizeDeps: {
		include: ['js-beautify'],
		exclude: ['jszip'],
		esbuildOptions: {
			define: {
				global: 'globalThis'
			}
		}
	},
	resolve: {
		alias: {}
	}
});
