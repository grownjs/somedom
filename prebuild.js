import {
  readdirSync, writeFileSync, readFileSync, mkdirSync, existsSync,
} from 'fs';

const srcDir = 'node_modules/himalaya/src';
const destDir = 'src/ssr/himalaya';

if (!existsSync(destDir)) mkdirSync(destDir);

readdirSync(srcDir).forEach(file => {
  let code = readFileSync(`${srcDir}/${file}`).toString();
  if (file === 'format.js') code = code.replace(/(type,)(\s+)(tagName:)/, '$1$2rawTagName:node.tagName,$2$3');
  writeFileSync(`${destDir}/${file.replace('.js', '.js')}`, code.replace(/(["'])(\.\/[/\w]+)\1/g, '"$2.js"'));
});
