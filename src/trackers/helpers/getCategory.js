const fs = require('fs')
const _ = require('underscore')
const parse = require('csv-parse/lib/sync')

function getCategories (categoryCSVfilePath) {
    const categoryCSV = fs.readFileSync(categoryCSVfilePath, 'utf8').split('\n')
    const categoryHeader = parse(categoryCSV.shift())[0].slice(1)

    const domainToCategory = categoryCSV.reduce((obj, row) => {
        
        row = parse(row)[0]
        if (!row) {return obj}

        const domain = row[0]

        // clean up category values. 1 means this is in the category, anything else no idea so skip it
        const rowArray = Array.from(row.slice(1)).map(c => {
            if (c === '1') {
                return 1
            } else if (c === '0' || c === '') {
                return 0
            }
            console.log(`unknown category value for ${domain}, ${c}`)
            return null
        })

        obj[domain] = _.object(categoryHeader, rowArray)
        return obj
    }, {})
    return domainToCategory
}

module.exports = {
    getCategories
}
