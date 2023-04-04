import fs from 'fs'
import { join } from 'path'

const tag = process.argv[2];
const trDir = process.argv[3];

let regions = fs.readdirSync(join(trDir, 'domains'));
if (!regions.includes('US')) {
    regions = ['']
}
for (const region of regions) {
    const baseDir = join(trDir, 'domains', region)
    const domainFiles = fs.readdirSync(baseDir);

    for (const file of domainFiles) {
        const data = JSON.parse(fs.readFileSync(join(baseDir, file), 'utf-8'))
        // format rules
        data.resources = data.resources.map(res => {
            res.rule = res.rule.replace(/\\/g, "");
            return res;
        })
        console.log([tag, region, file, JSON.stringify(data)].join('\t'))
    }
}