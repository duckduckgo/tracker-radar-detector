const fs = require('fs-extra')
const tldts = require('tldts-experimental')
const parse = require('csv-parse/lib/sync')
const config = require('./../../config.json')
const entityDir = `${config.trackerDataLoc}/entities`
const entityMap = require(`${config.trackerDataLoc}/build-data/generated/entity_map.json`)
const domainMap = require(`${config.trackerDataLoc}/build-data/generated/domain_map.json`)
const shortNames = require('./shortNames.js')
const dataToIngest = process.argv[2] ? require(`${process.argv[2]}`) : undefined

const applyChanges = () => {
    if (fs.existsSync('./data/entityUpdates.csv')) {
        applyCSVChanges()
    } else if (process.argv[2]) {
        console.log(`Importing data from ${process.argv[2]}`)
        applyManualChanges()
    } else {
        console.log("No file passed to command, processing manual changes to entity_map.json")
    }

    // sort properties and aliases alphabetically
    for (const hostname in entityMap) {
        const sortedProperties = entityMap[hostname].properties.sort()
        const sortedAliases = entityMap[hostname].aliases.sort()

        sortedProperties.forEach(prop => {
            const validDomain = tldts.getDomain(prop)
            if (!validDomain) {
                throw new Error(`INVALID DOMAIN: ${prop}`)
            }
        })
        entityMap[hostname].properties = Array.from(new Set(sortedProperties))
        entityMap[hostname].aliases = Array.from(new Set(sortedAliases))
    }

    // sort map alphabetically
    const sortedEntityMap = {}
    Object.keys(entityMap).sort().forEach(key => {
        sortedEntityMap[key] = entityMap[key]
    })
    // update entity map json files
    fs.writeFileSync(`${config.trackerDataLoc}/build-data/generated/entity_map.json`, JSON.stringify(sortedEntityMap, null, 4))
    // update domain map json files
    generateDomainMap(sortedEntityMap)
    // update individual entity files in tracker-data-set
    exportEntities(entityMap)
}

const applyCSVChanges = () => {
    const entityCSV = fs.readFileSync('./data/entityUpdates.csv')
    const domainChanges = parse(entityCSV, {columns: true})

    for (const row of domainChanges) {
        // ignore rows that haven't been validated
        if (row.acceptChange !== '1') {
            continue
        }

        const domain = row.domain
        const oldName = row.existingEntityName
        const name = row.newEntityName
        const shortName = row.displayName
        const oldEntity = entityMap[oldName] ? entityMap[oldName] : {}
        let newEntity = entityMap[name]

        // remove old entity if exists, merge into new one
        if (entityMap[oldName]) {
            delete entityMap[oldName]
        }

        if (typeof newEntity === 'undefined') {
            newEntity = {aliases: [name], properties: [domain], displayName: shortName}
        }
        // if existing entity with old name, merge its aliases and properties into new entity
        if (oldEntity.aliases) {
            newEntity.aliases = newEntity.aliases.concat(oldEntity.aliases)
        // if oldName present but no existing entity with that name, add it as an alias
        } else if (oldName) {
            newEntity.aliases.push(oldName)
        }
        newEntity.aliases = Array.from(new Set(newEntity.aliases))
        newEntity.aliases.sort()
        newEntity.displayName = shortName
        newEntity.properties = oldEntity.properties ? newEntity.properties.concat(oldEntity.properties) : newEntity.properties.concat([domain])
        newEntity.properties = Array.from(new Set(newEntity.properties))
        newEntity.properties.sort()
        entityMap[name] = newEntity
    }
}

const applyManualChanges = () => {
    for (const corp in dataToIngest) {
        const domains = dataToIngest[corp].properties || []
        const aliases = dataToIngest[corp].aliases || []
        aliases.push(corp)
        const displayName = dataToIngest[corp].displayName || shortNames.getDisplayName(corp)

        // first check if entity already exists. if it does, add domains and aliases to it.
        // otherwise create new entity
        if (entityMap[corp]) {
            const existingEntity = entityMap[corp]
            existingEntity.aliases = existingEntity.aliases.concat(aliases)

            // check if domains previously belonged to different entity.
            // if they did, converge other entity into this one
            for (const item in domains) {
                const domain = tldts.getDomain(domains[item])

                if (!domain) {
                    console.log(`INVALID DOMAIN: ${domains[item]}`)
                    continue
                }

                const previousName = domainMap[domain] && domainMap[domain].entityName

                if (previousName) {
                    const previousEntity = entityMap[previousName]
                    if (!previousEntity) {continue} // eslint-disable-line max-depth

                    existingEntity.aliases = existingEntity.aliases.concat(previousEntity.aliases)
                    existingEntity.properties = existingEntity.properties.concat(previousEntity.properties)
                    delete entityMap[previousName]
                } else {
                    existingEntity.properties.push(domain)
                }
            }
            existingEntity.aliases = Array.from(new Set(existingEntity.aliases)).sort()
            existingEntity.properties = Array.from(new Set(existingEntity.properties)).sort()
            entityMap[corp] = existingEntity
        } else {
            const newEntity = {
                aliases,
                properties: [],
                displayName
            }
            // check if domains previously belonged to different entity.
            // if they did, converge other entity into this one
            for (const item in domains) {
                const domain = tldts.getDomain(domains[item])

                if (!domain) {
                    console.log(`INVALID DOMAIN: ${domains[item]}`)
                    continue
                }

                const previousName = domainMap[domain] && domainMap[domain].entityName

                if (previousName) {
                    const previousEntity = entityMap[previousName]
                    if (!previousEntity) {continue} // eslint-disable-line max-depth

                    newEntity.aliases = newEntity.aliases.concat(previousEntity.aliases)
                    newEntity.properties = newEntity.properties.concat(previousEntity.properties)
                    delete entityMap[previousName]
                } else {
                    newEntity.properties.push(domain)
                }
            }

            newEntity.aliases = Array.from(new Set(newEntity.aliases)).sort()
            newEntity.properties = Array.from(new Set(newEntity.properties)).sort()
            entityMap[corp] = newEntity
        }
    }
}

const generateDomainMap = updatedEntityMap => {
    const sortedDomainMap = {}
    for (const name in updatedEntityMap) {
        const entity = updatedEntityMap[name]
        entity.properties.forEach(d => {
            if (sortedDomainMap[d]) {
                throw new Error(`[ALERT] ${d} has multiple owners: ${sortedDomainMap[d].entityName} and ${name}. Choose one, update entity_map.json and try again.`)
            }
            sortedDomainMap[d] = {entityName: name, aliases: entity.aliases, displayName: entity.displayName}
        })
    }
    fs.writeFileSync(`${config.trackerDataLoc}/build-data/generated/domain_map.json`, JSON.stringify(sortedDomainMap, null, 4))
}
// 1. delete files where entity name has changed and no longer in entity_map.json
// 2. update files where domain data in entity_map.json different from file
// 3. write files for entities in entity_map.json that don't have individual files.
const exportEntities = updatedEntityMap => {
    const filenames = fs.readdirSync(`${entityDir}`)
    for (const item in filenames) {
        const file = filenames[item]
        if (file[0] === ".") {continue}
        const contents = fs.readFileSync(`${entityDir}/${file}`)
        const jsonContent = JSON.parse(contents)
        const entityName = jsonContent.name
        const existingEntity = updatedEntityMap[entityName]
        if (typeof existingEntity === 'undefined') {
            console.log("entity no longer exists, deleting file", entityName)
            fs.unlinkSync(`${entityDir}/${file}`)
        } else {
            const fileDomains = jsonContent.properties
            const mapDomains = existingEntity.properties
            if (!(jsonContent.displayName === existingEntity.displayName &&
                fileDomains.length === mapDomains.length &&
                fileDomains.every((value, index) => value === mapDomains[index]))) {
                console.log("entity has changed, updating file", entityName)
                jsonContent.properties = mapDomains
                jsonContent.displayName = existingEntity.displayName
                fs.writeFileSync(`${entityDir}/${file}`, JSON.stringify(jsonContent, null, 4))
            }
        }
    }
    for (const entity in updatedEntityMap) {
        const entityData = updatedEntityMap[entity]
        const shortName = entityData.displayName || ''
        const domains = entityData.properties.sort()
        // remove ! and / from filenames before writing
        const entityFileName = entity.replace(/\/|!|"|:|>|<|\/|\\|\||\?|\*/g, '')
        if (!fs.existsSync(`${entityDir}/${entityFileName}.json`)) {
            console.log("new entity name, writing new file", entity)
            const dataToWrite = {name: entity, displayName: shortName, properties: domains}
            fs.writeFileSync(`${entityDir}/${entityFileName}.json`, JSON.stringify(dataToWrite, null, 4))
        }
    }
}

applyChanges()
