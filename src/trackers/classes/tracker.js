const tldjs = require('tldjs')
const performanceHelper = require('./../helpers/getPerformance.js')
const sharedData = require('./../helpers/sharedData.js')
const getFpRank = require('./../helpers/getFingerprintRank.js')
const cname = require('./../helpers/cname.js')

class Tracker {
    constructor(trackerData, crawledSiteTotal) {
        this.domain = trackerData.host
        let entity = _getEntity(this.domain)
        this.owner = {name: entity.name, displayName: entity.displayName || entity.name} || {}
        this.source = ['DuckDuckGo']
        
        const prevalence = _getPrevalence(this.domain)
        this.prevalence = +prevalence.toPrecision(3)
        this.sites = Math.round(prevalence * crawledSiteTotal)
        this.subdomains = []
        this.cnames = []

        this.fingerprinting = getFpRank(sharedData.domains[this.domain].fp || 0)
        this.resources = []
        this.categories = _getCategories(this.domain) || []
        this.performance = performanceHelper.getPerformance(this.domain, sharedData.config.performanceDataLoc) || {}
        this.cookies = +(_getCookies(this.domain).toPrecision(3))


        let policy = _getPolicy(this.domain, this.owner)
        
        if (policy) {
            this.owner.privacyPolicy = policy
            this.owner.url = `http://${tldjs.parse(policy).domain}`
        }

        const breaking = _getBreaking(this.domain)
        if (breaking) {this.breaking = breaking}

        if (sharedData.config.flags.addSurrogates) {
            this.addSurrogates()
        }

        this.types = {}
    }

    addTypes (type, count) {
        if (!this.types[type]) {
            this.types[type] = count
        } else {
            this.types[type] += count
        }
    }

    addRule (rule) {
        this.resources.push(rule)
        this.subdomains = [...new Set(this.subdomains.concat(rule.subdomains))]
        rule.cnames.forEach(record => {
            if (!cname.containsCnameRecord(this.cnames, record)) {
                this.cnames.push(record)
            }
        })
        this.cnames.sort((a,b) => a.original.localeCompare(b.original))
    }

    addSurrogates () {
        const trackerSurrogates = _getSurrogates(this.domain)
        if (trackerSurrogates) {this.surrogates = trackerSurrogates}
    }

    addRegion (countryCode) {
        this.source = [`DuckDuckGo-${countryCode}`]
    }
}

function _getPolicy (domain, owner={}) {
    if (sharedData.policies[domain]) {
        return sharedData.policies[domain].privacyPolicy
    } else if (owner.name && sharedData.policies[owner.name]) {
        return sharedData.policies[owner.name].privacyPolicy
    }
}

function _getEntity (domain) {
    return sharedData.domainToEntity[domain] || {}
}

function _getCategories (domain) {
    if (sharedData.categories[domain]) {
        return Object.keys(sharedData.categories[domain]).reduce((cats, key) => {
            if (sharedData.categories[domain][key]) {cats.push(key)}
            return cats
        },[])
    }
}

function _getPrevalence (domain) {
    return sharedData.domains[domain].prevalence || 0
}

function _getCookies (domain) {
    return sharedData.domains[domain].cookies || 0
}

function _getSurrogates (domain) {
    let trackerSurrogates = []

    if (sharedData.surrogates[domain]) {
        for (let [req, resource] of sharedData.surrogates[domain]) {
            trackerSurrogates.push({rule: req, replaceWith: resource})
        }
    }

    if (trackerSurrogates.length) {return trackerSurrogates}

    
}

// Look up and add request breakage data for this domian
function _getBreaking (domain) {
    if (sharedData.breaking) {
        let breaking = []
        for (const [type, data] of Object.entries(sharedData.breaking)) {
            // only look at request type breaking data
            if (type.match('breaking-request')) {
                if (data[domain]) {
                    data[domain].forEach(e => breaking.push(e))
                }
            }
        }

        if (breaking.length) {
            return breaking
        }
    }

    
}

module.exports = Tracker
