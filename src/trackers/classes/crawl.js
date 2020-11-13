const fs = require('fs')
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

        // summary of 3p requests seen in the crawl
        this.commonRequests = {}

        // Sites that are CNAME cloaked as first party.
        this.domainCloaks = {}

        this.pageMap = {}

        // for calculating api fingerprint weights
        this.fpWeights = {
            scripts: {tracking: 0, nontracking: 0},
            apis: {}
        }
    }

    writeSummaries () {
        _writeSummaries(this)
    }

    processSite (site) {
        _processSite(this, site)
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

function _processSite (crawl, site) {
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
    })

    // update the number of sites an entity was seen tracking or not-tracking on
    for (const [entity, data] of Object.entries(site.uniqueEntities)) {
        crawl.entityPrevalence[entity] ? '' : crawl.entityPrevalence[entity] = {tracking: 0, nonTracking: 0}
        data.tracking ? crawl.entityPrevalence[entity].tracking++ : crawl.entityPrevalence[entity].nonTracking++
    }

    // add common requests entries for each of the requests found on the site
    site.requests.forEach(request => {
        if (!request.domain) {
            crawl.stats.requestsSkipped++
            return
        }

        const key = _getCommonRequestKey(request)

        if (!crawl.commonRequests[key]) {
            crawl.commonRequests[key] = new CommonRequest(request, site)
        } else {
            crawl.commonRequests[key].update(request, site)
        }
    })

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

    return domainSummary
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

    fs.writeFileSync(`${shared.config.trackerDataLoc}/commonRequests.json`, JSON.stringify({stats: crawl.stats, requests: crawl.commonRequests}, null, 4))

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

    fs.writeFileSync(`${shared.config.trackerDataLoc}/build-data/generated/api_fingerprint_weights.json`, JSON.stringify(getFingerprintWeights(crawl), null, 4))
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
