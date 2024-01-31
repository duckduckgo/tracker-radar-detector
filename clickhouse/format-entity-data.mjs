import fs from 'fs'
import { join } from 'path'

const tag = process.argv[2];
const trDir = process.argv[3];

const baseDir = join(trDir, 'entities')
const entityFiles = fs.readdirSync(baseDir);

for (const file of entityFiles) {
    const data = JSON.parse(fs.readFileSync(join(baseDir, file), 'utf-8'))
    console.log([tag, file, JSON.stringify(data)].join('\t'))
}
