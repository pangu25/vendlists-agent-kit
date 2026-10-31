import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const result = await build({ entryPoints: [new URL('./src/workbench.mjs', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true });
const template = await readFile(new URL('./src/workbench.html', import.meta.url), 'utf8');
const logo = await readFile(new URL('../plugins/chatgpt/assets/logo.png', import.meta.url));
const html = template.replace('__LOGO_DATA__', `data:image/png;base64,${logo.toString('base64')}`).replace('__SCRIPT__', result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await writeFile(new URL('./dist/workbench.html', import.meta.url), html);
console.log(`Built self-contained workbench (${Buffer.byteLength(html)} bytes)`);
