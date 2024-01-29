const fs = require('fs')
const parse = require('csv-parse/lib/sync')

function getCategories (categoryCSVfilePath) {
    const records = parse(fs.readFileSync(categoryCSVfilePath, 'utf8'), {
        columns: true,
        delimiter: ',',
    })
    console.log(records)

    const domainToCategory = records.reduce((obj, row) => {
        const domain = row.domain
        obj[domain] = row
        delete row.domain
        Object.keys(row).forEach(category => {
            const c = row[category]
            if (c === '1') {
                row[category] = 1
            } else if (c === '0' || c === '') {
                row[category] = 0
            } else {
                console.log(`unknown category value for ${domain}, ${c}`)
                row[category] = null
            }
        })
        return obj
    }, {})
    return domainToCategory
}

module.exports = {
    getCategories
}
