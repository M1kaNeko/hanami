import {build} from 'esbuild';
await build({entryPoints:['src/main/index.ts'],outfile:'dist/main/index.cjs',bundle:true,platform:'node',format:'cjs',external:['electron'],sourcemap:true});
await build({entryPoints:['src/preload/index.ts'],outfile:'dist/preload/index.cjs',bundle:true,platform:'node',format:'cjs',external:['electron']});
