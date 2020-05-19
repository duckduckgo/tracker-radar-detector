const fs = require('fs')
const {median, std} = require('mathjs')
const shared = require('./../helpers/sharedData.js')
const CommonRequest = require('./commonRequest.js')

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

        this.urlParameters = {}

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

    // count url search parameters
    var siteParamMap = {}
    for (param of site.searchParams) {
        const paramName = param.param
        if (crawl.urlParameters[paramName]) {
            crawl.urlParameters[paramName].requests++
            if (!crawl.urlParameters[paramName].domains.includes(param.domain)) {
                crawl.urlParameters[paramName].domains.push(param.domain)
            }
            if (!siteParamMap[paramName]) {
                crawl.urlParameters[paramName].sites++
                siteParamMap[paramName] = true
            }
        } else {
            crawl.urlParameters[paramName] = { requests: 1, sites: 1, domains: [param.domain] }
            siteParamMap[paramName] = true
        }
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
    let domainSummary = {}
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

    return domainSummary
}

function _getEntitySummaries (crawl) {
    delete crawl.entityPrevalence.undefined

    // calculate the overall entity prevalence
    for (let entity of Object.keys(crawl.entityPrevalence)) {
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

    fs.writeFileSync(`${shared.config.trackerDataLoc}/build-data/generated//entity_prevalence.json`, JSON.stringify(crawl.entityPrevalence, null, 4))

    // write entity prevalence csv
    let csv = []
    for (const entity in crawl.entityPrevalence) {
        csv.push([entity.replace(/"/g,''), crawl.entityPrevalence[entity].total, crawl.entityPrevalence[entity].tracking, crawl.entityPrevalence[entity].nonTracking])
    }

    // write entity prevalence data to individual entity files
    updateEntityPrevalence(crawl)

    csv = csv.sort((a, b) => b[1] - a[1])
    fs.writeFileSync(`${shared.config.trackerDataLoc}/build-data/generated/entity_prevalence.csv`, csv.reduce((str, row) => {str += `"${row[0]}",${row[1]},${row[2]},${row[3]}\n`; return str}, 'Entity,Total Prevalence,Tracking Prevalence,Non-tracking Prevalence\n'))

    var sortableUrlParameters = [];
    for (var key in crawl.urlParameters) {
        sortableUrlParameters.push([key, crawl.urlParameters[key].sites, crawl.urlParameters[key].requests, crawl.urlParameters[key].domains]);
    }
    sortableUrlParameters.sort((a, b) => b[1] - a[1]);
    fs.writeFileSync(`${shared.config.trackerDataLoc}/urlParameters.json`, JSON.stringify(sortableUrlParameters));
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
