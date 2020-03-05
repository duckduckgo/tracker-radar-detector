const fs = require('fs-extra')
const parse = require('csv-parse/lib/sync')
const config = require('./../../config.json')
const entityDir = `${config.trackerDataLoc}/entities`
const entityMap = require(`${config.trackerDataLoc}/build-data/generated/entity_map.json`)
const entityCSV = fs.readFileSync('./data/entityUpdates.csv')

const applyChanges = () => {
    const domainChanges = parse(entityCSV, {columns: true})

    for (let row of domainChanges) {
        // ignore rows that haven't been validated
        if (row.acceptChange !== '1') {
            continue
        }

        const domain = row.domain
        const oldName = row.existingEntityName
        const name = row.newEntityName
        const shortName = row.displayName
        let oldEntity = entityMap[oldName] ? entityMap[oldName] : {}
        let newEntity = entityMap[name]

        // remove old entity if exists, merge into new one
        if (entityMap[oldName]) {
            delete entityMap[oldName]
        }

        if (typeof newEntity === 'undefined') {
            newEntity = {aliases: [name], properties: [domain], displayName: shortName}
        }
        newEntity.displayName = shortName
        newEntity.aliases = oldEntity.aliases ? newEntity.aliases.concat(oldEntity.aliases) : newEntity.aliases
        newEntity.aliases = Array.from(new Set(newEntity.aliases))
        newEntity.properties = oldEntity.properties ? newEntity.properties.concat(oldEntity.properties) : newEntity.properties.concat([domain])
        newEntity.properties = Array.from(new Set(newEntity.properties))
        newEntity.properties.sort()
    }
    // update entityMap.json
    fs.writeFileSync(`${config.trackerDataLoc}/build-data/generated/entity_map.json`, JSON.stringify(entityMap, null, 4))
    // update domainMap.json
    generateDomainMap(entityMap)
    // update individual entity files in tracker-data-set
    exportEntities(entityMap)
}

const generateDomainMap = updatedEntityMap => {
    let newDomainMap = {}
    for (let name in updatedEntityMap) {
        const entity = updatedEntityMap[name]
        entity.properties.forEach(d => {
            newDomainMap[d] = {entityName: name, aliases: entity.aliases}
        })
    }
    fs.writeFileSync(`${config.trackerDataLoc}/build-data/generated/domain_map.json`, JSON.stringify(newDomainMap, null, 4))
}

const exportEntities = updatedEntityMap => {
    // remove existing entity files
    fs.emptyDirSync(entityDir)
    for (let entity in updatedEntityMap) {
        const entityData = updatedEntityMap[entity]
        const shortName = entityData.displayName || ''
        const domains = entityData.properties
        // remove ! and / from filenames before writing
        const entityFileName = entity.replace(/\//g,'').replace(/!/g,'')
        const dataToWrite = {name: entity, displayName: shortName, properties: domains}
        fs.writeFileSync(`${entityDir}/${entityFileName}.json`, JSON.stringify(dataToWrite, null, 4))
    }
}

applyChanges()
