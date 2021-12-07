const fs = require('fs')
const chalk = require('chalk')

const config = require('./../../../config.json')
const categoryHelper = require(`./getCategory.js`)
const URL = require('./url.js')
const NameServers = require('./nameserver.js')

class SharedData {
    constructor (cfg) {
        console.log(chalk.green("Reading static data"))
        const build = `${cfg.trackerDataLoc}/build-data`

        this.config = cfg
        this.policies = _getJSON(`${build}/static/privacy_policies.json`)
        this.surrogates = _getJSON(`${cfg.surrogatesDataLoc}/mapping.json`)
        this.domains = _getJSON(`${build}/generated/domain_summary.json`) || {}
        this.abuseScores = _getJSON(`${build}/generated/api_fingerprint_weights.json`)
        this.categories = _getCategories()
        
        const {domainToEntity, entityMap} = _readEntities(`${cfg.trackerDataLoc}/entities`)
        this.domainToEntity = domainToEntity
        this.entityMap = entityMap

        this.breaking = _getBreaking(`${build}/static/breaking`)
        this.topExampleSitesSet = _getTopExampleSites(cfg)
        this.nameservers = NameServers

        if (this.config.nameserverMapLoc) {
            const nameserverData = _getJSON(this.config.nameserverMapLoc)
            if (nameserverData && nameserverData.length) {
                this.nameserverMap = nameserverData
            }
        }
    }
}

// map entity domains to name for easy lookup
function _readEntities (path) {
    const domainToEntity = {}
    const entityMap = new Map()

    if (fs.existsSync(path)) {
        fs.readdirSync(`${config.trackerDataLoc}/entities/`).forEach(entityFile => {
            const entityData = _getJSON(`${config.trackerDataLoc}/entities/${entityFile}`)

            entityData.properties.forEach(url => {
                domainToEntity[url] = entityData
                entityMap.set(url, entityData.name)
            })
        })
    }

    return {
        domainToEntity,
        entityMap
    }
}

// option list of top example sites to include in tracker files
function _getTopExampleSites () {
    if (!config.topExampleSites || !fs.existsSync(config.topExampleSites)) {
        return null
    }
    return new Set(JSON.parse(fs.readFileSync(config.topExampleSites, 'utf8')))
}

// read tracker category data from csv and return object
function _getCategories () {
    try {
        return categoryHelper.getCategories(`${config.trackerDataLoc}/build-data/static/categorized_trackers.csv`)
    } catch (e) {
        console.warn('Could not load categories', e)
        return {}
    }
}

// read temp and longterm breaking requests files. return breaking data object keyed on domain
function _getBreaking (dirPath) {
    try {
        const files = fs.readdirSync(dirPath)
        return files.reduce((breakingData, file) => {

            const key = file.replace('.json', '')
            const data = _getJSON(`${dirPath}/${file}`)

            // group the breaking request type data by domain for faster look up
            if (file.match('breaking-request')) {
                const groupedData = data.reduce((grouped, entry) => {
                    // unescape and get domain key
                    const domain = new URL(`http://${entry.rule.replace(/\\/g, "")}`).domain
                    grouped[domain] ? grouped[domain].push(entry) : grouped[domain] = [entry]
                    return grouped
                }, {})

                breakingData[key] = groupedData
            } else {
                breakingData[key] = data
            }

            return breakingData
        }, {})
    } catch (e) {
        console.warn('Error loading breaking data', e)
        return {}
    }
}

function _getJSON (path) {
    try {
        return JSON.parse(fs.readFileSync(path, 'utf8'))
    } catch (e) {
        console.log(e)
        return {}
    }
}

module.exports = new SharedData(config)
