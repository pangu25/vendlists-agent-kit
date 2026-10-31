import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const root = resolve(new URL('../', import.meta.url).pathname), source = join(root,'plugins/chatgpt');
const readJSON = async path => JSON.parse(await readFile(path,'utf8'));
const plugin = await readJSON(join(source,'plugin.json')), mcp = await readJSON(join(source,'mcp.json'));
const ajv = new Ajv({ allErrors:true, strict:false }); addFormats(ajv);
for (const [name,data] of [['plugin',plugin],['mcp',mcp]]) {
 const validate=ajv.compile(await readJSON(join(root,`scripts/schemas/${name}-1.0.0.json`)));
 if(!validate(data)) throw new Error(JSON.stringify(validate.errors));
}
const fail = (ok,message) => { if(!ok) throw new Error(message); };
const extension=plugin.extensions['com.openai'],ui=extension.interface,review=extension.review;
fail(ui.displayName==='Vendlists','Use the actual brand name');
fail(ui.shortDescription.length<=30 && ui.longDescription.length<=4000,'Directory text exceeds limits');
fail(ui.defaultPrompt.length<=3 && new Set(ui.defaultPrompt).size===ui.defaultPrompt.length && ui.defaultPrompt.every(p=>p.length<=128&&!p.includes('@')),'Invalid prompt starters');
for(const key of ['websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL']) fail(new URL(ui[key]).protocol==='https:',`${key} must use HTTPS`);
fail(Object.keys(mcp.mcpServers).length===1 && mcp.mcpServers.vendlists.url==='https://api.vendlists.com/agent/mcp','One remote production MCP required');
fail(review.test_cases.positive.length===5 && review.test_cases.negative.length===3,'Require five positive and three negative review cases');
fail(review.commerce===true,'Physical-goods listing publication is commerce');
fail(!('test_credentials' in review)&&!('reviewer_instructions' in review),'No reviewer credentials/instructions in ZIP');
if(process.argv.includes('--release')) fail(typeof review.demo_recording_url==='string' && new URL(review.demo_recording_url).protocol==='https:','Release requires a real reviewer-accessible demo recording');
const entries=[];
async function walk(dir) {
 for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
  fail(!entry.isSymbolicLink(),'No symlinks in the upload package');const path=join(dir,entry.name);
  if(entry.isDirectory()) await walk(path);else entries.push(relative(source,path));
 }
}
await walk(source);
for(const name of entries) {
 fail(!/(^|\/)(\.env|node_modules|\.git|test_credentials|reviewer_instructions)/.test(name),'Unexpected private/development file');
 if(name.endsWith('.md')||name.endsWith('.json')) {
  const text=await readFile(join(source,name),'utf8');fail(!/BEGIN (?:RSA |EC )?PRIVATE KEY|sk_live_[A-Za-z0-9]|vl_agent_[A-Za-z0-9_-]{24,}/.test(text),'Credential-shaped content in package');
 }
}
for(const asset of [ui.logo,ui.composerIcon,extension.onboardingSkill]) {const path=resolve(source,asset);fail(path.startsWith(source+'/'),'Asset escapes plugin root');fail((await stat(path)).isFile(),'Referenced asset missing');}
for(const skill of entries.filter(p=>p.endsWith('SKILL.md'))) {const text=await readFile(join(source,skill),'utf8');fail(/^---\nname: /m.test(text)&&/\ndescription: /m.test(text),'Skill frontmatter missing');}
console.log(`Validated ${entries.length} source files, portable schemas, directory limits, review cases and credential exclusions.`);
if(process.argv.includes('--pack')) {
 const out=join(root,'dist');await mkdir(out,{recursive:true});const zip=join(out,`vendlists-chatgpt-${plugin.version}.zip`);
 const script=`import zipfile,sys,pathlib\nsource=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:\n for path in sorted(source.rglob('*')):\n  if path.is_file():\n   info=zipfile.ZipInfo(str(path.relative_to(source)),(2026,10,3,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;archive.writestr(info,path.read_bytes())\n`;
 execFileSync('python3',['-c',script,source,zip]);const bytes=await readFile(zip);const report={version:plugin.version,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,files:entries,stage:'candidate; hosted MCP/OAuth deployment, live host QA and reviewer demo required before review'};
 await writeFile(join(out,'chatgpt-package-report.json'),JSON.stringify(report,null,2)+'\n');console.log(`Packed ${zip} (${bytes.length} bytes, SHA256 ${report.sha256})`);
}
