/* eslint-disable max-depth */
const fs = require('fs')
const path = require('path')
const {median, std} = require('mathjs')
const shared = require('./../helpers/sharedData.js')
const CommonRequest = require('./commonRequest.js')
const sharedData = require('./../helpers/sharedData.js')
const {getFingerprintWeights} = require('./../helpers/fingerprints.js')

const API_COUNT_THRESHOLD = 15

class Crawl {
    constructor () {
        this.stats = {
            sites: 0,
            requests: 0,
            requestsSkipped: 0
        }

        this.domainPrevalence = {}

        // fingerprinting done by each 3p domain across the whole crawl
        this.domainFingerprinting = {}

        // sites that a cookie has been set on by each 3p domain
        this.domainCookies = {}

        // overall entity prevalence split into tracking and non-tracking
        this.entityPrevalence = {}

        // updated entity data that will be exported after the analysis
        this.entityData = {}

        // summary of 3p requests seen in the crawl
        this.commonRequests = {}

        // Sites that are CNAME cloaked as first party.
        this.domainCloaks = {}

        // initiators for 3p domain across the whole crawl
        this.domainInitiators = {}

        this.pageMap = {}

        // for calculating api fingerprint weights
        this.fpWeights = {
            scripts: {tracking: 0, nontracking: 0},
            apis: {}
        }

        // Per-site data
        this.dataBySite = {}
    }

    exportEntities() {
        for (const [entityName, data] of Object.entries(this.entityData)) {
            const entityFile = path.join(shared.config.trackerDataLoc, 'entities', `${entityName}.json`)
            fs.writeFileSync(entityFile, JSON.stringify(data, null, 4))
        }
    }

    writeSummaries () {
        _writeSummaries(this)
    }

    async processSite (site) {
        await _processSite(this, site)
    }

    finalizeRequests () {
        for (const [key, request] of Object.entries(this.commonRequests)) {
            if (request.sites < shared.config.minSites) {
                delete this.commonRequests[key]
                continue
            }

            this.pageMap[request.rule] = [...request.pages]

            request.finalize(this.stats.sites)
        }
    }
}

/**
 * Add domain to entity property list when nameserver match is found. 
 * @param {Crawl} crawl - reference to the current crawl
 * @param {string} entityName - entity file name to update
 * @param {string} domain - domain name to add to the entity properties list
 */
function _updateEntityProperties (crawl, entityName, domain) {
    if (!(entityName in crawl.entityData)) {
        const entityFile = path.join(shared.config.trackerDataLoc, 'entities', `${entityName}.json`)

        try {
            const data = fs.readFileSync(entityFile, 'utf8')
            const entityData = JSON.parse(data)
            crawl.entityData[entityName] = entityData
        } catch (e) {
            console.error(`Could not update entity data: ${e} ${e.stack}`)
            return
        }
    }
    const entityData = crawl.entityData[entityName]
    if (!entityData.properties.includes(domain)) {
        entityData.properties.push(domain)
    }
}

async function _processSite (crawl, site) {
    // go through the uniqueDomains found on the site and update the crawl domain prevalence, fingerprinting, and cookies
    Object.keys(site.uniqueDomains).forEach(domain => {
        crawl.domainPrevalence[domain] ? crawl.domainPrevalence[domain] += 1 : crawl.domainPrevalence[domain] = 1

        if (crawl.domainFingerprinting[domain]) {
            crawl.domainFingerprinting[domain].push(site.uniqueDomains[domain].fingerprinting)
        } else {
            crawl.domainFingerprinting[domain] = [site.uniqueDomains[domain].fingerprinting]
        }

        if (site.uniqueDomains[domain].setsCookies) {
            crawl.domainCookies[domain] ? crawl.domainCookies[domain]++ : crawl.domainCookies[domain] = 1
        }

        if (site.uniqueDomains[domain].usesCNAMECloaking) {
            crawl.domainCloaks[domain] ? crawl.domainCloaks[domain]++ : crawl.domainCloaks[domain] = 1
        }

        if (site.uniqueDomains[domain].initiators) {
            for (const initiator of Object.keys(site.uniqueDomains[domain].initiators)) {
                const count = site.uniqueDomains[domain].initiators[initiator]
                crawl.domainInitiators[domain] = crawl.domainInitiators[domain] || {}
                crawl.domainInitiators[domain][initiator] ? crawl.domainInitiators[domain][initiator] += count : crawl.domainInitiators[domain][initiator] = count
            }
        }
    })

    // update the number of sites an entity was seen tracking or not-tracking on
    for (const [entity, data] of Object.entries(site.uniqueEntities)) {
        crawl.entityPrevalence[entity] ? '' : crawl.entityPrevalence[entity] = {tracking: 0, nonTracking: 0}
        data.tracking ? crawl.entityPrevalence[entity].tracking++ : crawl.entityPrevalence[entity].nonTracking++
    }

    // add common requests entries for each of the requests found on the site
    for (const request of site.requests) {
        if (!request.domain) {
            crawl.stats.requestsSkipped++
            continue
        }

        if (!site.isFirstParty(request.url)) {
            const nameservers = await shared.nameservers.resolveNs(request.domain)
    
            if (nameservers && nameservers.length) {
                request.nameservers = nameservers
    
                // The option to group by nameservers is set in the config
                // All nameservers must match so we can do a quick check to see that the first nameserver exists in our data
                if (shared.nameserverList && shared.nameserverToEntity[request.nameservers[0]]) {
                    for (const nsEntry of shared.nameserverList) {
                        const entityNS = new Set(nsEntry.nameservers)

                        // all nameservers in set must match
                        const nsDiff = request.nameservers.filter(x => !entityNS.has(x))

                        if (nsDiff && nsDiff.length === 0) {
                            _updateEntityProperties(crawl, nsEntry.name, request.domain)
                            request.owner = nsEntry.name
                            break
                        }
                    }
                }
            }
        }

        const key = _getCommonRequestKey(request)

        if (!crawl.commonRequests[key]) {
            crawl.commonRequests[key] = new CommonRequest(request, site)
        } else {
            crawl.commonRequests[key].update(request, site)
        }
    }

    // analyse per-site script fingerprinting
    for (const [script, apis] of Object.entries(site.siteData.data.apis.callStats)) {
        const scriptMatch = shared.config.analyseScripts.find(r => script.match(r))
        if (scriptMatch === undefined) {
            continue
        }
        if (!crawl.dataBySite[site.domain]) {
            crawl.dataBySite[site.domain] = {}
        }
        if (!crawl.dataBySite[site.domain][site.host]) {
            crawl.dataBySite[site.domain][site.host] = {fingerprinting: {}}
        }
        const fp = crawl.dataBySite[site.domain][site.host].fingerprinting
        if (!fp[scriptMatch]) {
            fp[scriptMatch] = {apis: []}
        }
        fp[scriptMatch].apis = [...new Set([...fp[scriptMatch].apis, ...Object.keys(apis)])].sort()
    }

    for (const apis of Object.values(site.siteData.data.apis.callStats)) {
        const apisUsed = Object.keys(apis)
        
        let tracking = false
        if (apisUsed.length >= API_COUNT_THRESHOLD) {
            tracking = true
        }
        
        if (tracking) {
            crawl.fpWeights.scripts.tracking++
        } else {
            crawl.fpWeights.scripts.nontracking++
        }

        apisUsed.forEach(api => {
            if (!crawl.fpWeights.apis[api]) {
                crawl.fpWeights.apis[api] = {tracking: 0, nontracking: 0}
            }

            if (tracking) {
                crawl.fpWeights.apis[api].tracking++
            } else {
                crawl.fpWeights.apis[api].nontracking++
            }
        })
    }
}

function _getCommonRequestKey (request) {
    let key = request.domain

    if (request.path) {
        key += request.path
    }
    return `${key} - ${request.type}`
}

// build a single object with domain prevalence, fingerprint, and cookie data
function _getDomainSummaries (crawl) {
    const domainSummary = {}
    // calculate prevalence
    Object.keys(crawl.domainPrevalence).forEach(domain => {
        domainSummary[domain] = {prevalence: 0, cookies: 0, fp: 0}
        domainSummary[domain].prevalence = +(crawl.domainPrevalence[domain] / crawl.stats.sites)
    })

    // calculate cookie percent
    Object.keys(crawl.domainCookies).forEach(domain => {domainSummary[domain].cookies = +(crawl.domainCookies[domain] / crawl.stats.sites)})

    // calculate average fp
    Object.keys(crawl.domainFingerprinting).forEach(domain => {
        domainSummary[domain].fp = median(crawl.domainFingerprinting[domain]) + std(crawl.domainFingerprinting[domain])
    })

    // How often does this domain appear cloaked?
    Object.keys(crawl.domainCloaks).forEach(domain => {
        domainSummary[domain].cloaked = crawl.domainCloaks[domain] / crawl.domainPrevalence[domain]
    })

    // top initiators
    Object.keys(crawl.domainInitiators).forEach(domain => {
        let requests = 0
        let top = []

        Object.keys(crawl.domainInitiators[domain]).forEach(init => {
            requests += crawl.domainInitiators[domain][init]
        })

        // transform to [{domain: initiator.com, prevalence: 0.1}] where prevalence is calculated for all requests
        Object.keys(crawl.domainInitiators[domain]).forEach(init => {
            top.push({domain: init, prevalence: crawl.domainInitiators[domain][init] / requests})
        })

        // sort by prevalence, get top 10
        top = top.sort((a, b) => b.prevalence - a.prevalence)
        if (top.length > 10) {
            top.length = 10
        }

        domainSummary[domain].topInitiators = top
    })

    return domainSummary
}

function _getDataBySite (crawl) {
    return crawl.dataBySite
}

function _getEntitySummaries (crawl) {
    delete crawl.entityPrevalence.undefined

    // calculate the overall entity prevalence
    for (const entity of Object.keys(crawl.entityPrevalence)) {
        crawl.entityPrevalence[entity].total =
            +((crawl.entityPrevalence[entity].tracking + crawl.entityPrevalence[entity].nonTracking)/crawl.stats.sites).toPrecision(3)

        crawl.entityPrevalence[entity].tracking = +(crawl.entityPrevalence[entity].tracking/crawl.stats.sites).toPrecision(3)

        crawl.entityPrevalence[entity].nonTracking = +(crawl.entityPrevalence[entity].nonTracking/crawl.stats.sites).toPrecision(3)
    }


}

function _writeSummaries (crawl) {
    fs.writeFileSync(`${shared.config.trackerDataLoc}/build-data/generated/domain_summary.json`, JSON.stringify(_getDomainSummaries(crawl), null, 4))
    fs.writeFileSync(`${shared.config.trackerDataLoc}/build-data/generated/data_by_site.json`, JSON.stringify(_getDataBySite(crawl), null, 4))

    fs.writeFileSync(`${shared.config.trackerDataLoc}/crawlStats.json`, JSON.stringify(crawl.stats, null, 4))

    // commonRequests array is to big to be stringified in one shot, we have to chunk it
    const requestsArray = Object.values(crawl.commonRequests)
    const CHUNK = 50000
    const requestArrayLen = requestsArray.length

    // remove old chunks
    fs.readdirSync(`${shared.config.trackerDataLoc}/`).forEach(file => {
        if (file.startsWith('commonRequests-') && file.endsWith('.json')) {
            fs.unlinkSync(path.join(shared.config.trackerDataLoc, file))
        }
    })

    for (let i=0; i<requestArrayLen; i+=CHUNK) {
        const requestArrayChunk = requestsArray.slice(i, i+CHUNK)
        fs.writeFileSync(`${shared.config.trackerDataLoc}/commonRequests-${i/CHUNK}.json`, JSON.stringify(requestArrayChunk, null, 4))
    }

    _getEntitySummaries(crawl)

    fs.writeFileSync(`${shared.config.trackerDataLoc}/build-data/generated/entity_prevalence.json`, JSON.stringify(crawl.entityPrevalence, null, 4))

    if (shared.config.includePages) {
        fs.writeFileSync(`${sharedData.config.pageMapLoc}/pagemap.json`, JSON.stringify(crawl.pageMap, null, 4))
    }

    // write entity prevalence csv
    let csv = []
    for (const entity in crawl.entityPrevalence) {
        csv.push([entity.replace(/"/g,''), crawl.entityPrevalence[entity].total, crawl.entityPrevalence[entity].tracking, crawl.entityPrevalence[entity].nonTracking])
    }

    // write entity prevalence data to individual entity files
    updateEntityPrevalence(crawl)

    csv = csv.sort((a, b) => b[1] - a[1])
    fs.writeFileSync(`${shared.config.trackerDataLoc}/build-data/generated/entity_prevalence.csv`, csv.reduce((str, row) => {str += `"${row[0]}",${row[1]},${row[2]},${row[3]}\n`; return str}, 'Entity,Total Prevalence,Tracking Prevalence,Non-tracking Prevalence\n'))

    if (shared.config.overrideFingerprintWeights) {
        fs.writeFileSync(`${shared.config.trackerDataLoc}/build-data/generated/api_fingerprint_weights.json`, JSON.stringify(getFingerprintWeights(crawl), null, 4))
    }
}

function updateEntityPrevalence (crawl) {
    const entities = fs.readdirSync(`${shared.config.trackerDataLoc}/entities`)
    entities.forEach(file => {
        const entityFilePath = `${shared.config.trackerDataLoc}/entities/${file}`
        const entity = JSON.parse(fs.readFileSync(entityFilePath, 'utf8'))
        // look up entity prevalence data
        if (crawl.entityPrevalence[entity.name]) {
            const tracking = crawl.entityPrevalence[entity.name].tracking
            const nonTracking = crawl.entityPrevalence[entity.name].nonTracking

            entity.prevalence = {
                tracking,
                nonTracking,
                total: +(tracking + nonTracking).toPrecision(3)
            }

            fs.writeFileSync(entityFilePath, JSON.stringify(entity, null, 4))
        }
    })
}

module.exports = new Crawl()
