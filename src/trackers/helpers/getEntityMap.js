/* domain -> entity mapping */
const fs = require('fs')

const entityMap = entityDataLoc => {
    const entityFiles = fs.readdirSync(entityDataLoc)
    const map = new Map()

    entityFiles.forEach(f => {
        const entity = JSON.parse(fs.readFileSync(`${entityDataLoc}/${f}`, 'utf8'))
        entity.properties.forEach(site => {
            map.set(site, entity.name)
        })
    })
    return map
}

module.exports = {
    entityMap
}
