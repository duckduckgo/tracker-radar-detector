const Request = require('./request.js')
const shared = require('./../helpers/sharedData.js')
const ParsedUrl = require('./../helpers/parseUrl.js')

class Site {
    constructor (siteData) {
        this.siteData = siteData

        const url = new ParsedUrl(siteData.initialUrl)
        this.host = url.hostname
        this.domain = url.domain
        this.subdomain = url.subdomain
        this.searchParams = url.searchParams;

        // unique 3p domains on this site with overall fingerprint score for each
        this.uniqueDomains = {}

        // unique 3p entities on the site. marking if they are tracking or not
        this.uniqueEntities = {}

        // cookies that were set on the site
        this.cookies = _getCookies(siteData)

        this.requests = []

        this.owner = shared.entityMap.get(this.domain)
    }

    processRequest (requestData) {
        _processRequest(requestData, this)
    }
}

// Cookie data from the crawler has the domain and path split
// we will parse and combine those parts to get a single domain
function _getCookies (siteData) {
    return  siteData.data.cookies.reduce((cookieObj, cookie) => {
       // some domains will have a leading period we need to remove
        let cookieHost = new ParsedUrl(`http://${cookie.domain.replace(/^\./,'')}`).hostname
        cookieObj[`${cookieHost}${cookie.path}`]
        return cookieObj
    }, [])
}

function _processRequest (requestData, site) {
    const request = new Request(requestData, site)

    if (request.isFirstParty && !shared.config.keepFirstParty) {
        return
    }

    if (request.setsCookies || Object.keys(request.apis).length) {
        request.isTracking = true
    }

    // The entities found on a site are either tracking or not tracking, e.g., a single tracking request sets the entity as a tracker
    if(request.owner && typeof site.uniqueEntities[request.owner] !== 'undefined') {
        if (request.isTracking && site.uniqueEntities[request.owner].tracking === false) {
            site.uniqueEntities[request.owner].tracking = true
        }
    } else {
        site.uniqueEntities[request.owner] = {tracking: request.isTracking}
    }

    if (request.domain && typeof site.uniqueDomains[request.domain] !== 'undefined') {
        site.uniqueDomains[request.domain].fingerprinting += request.fingerprintScore

    } else {
        site.uniqueDomains[request.domain] = {fingerprinting: request.fingerprintScore, setsCookies: false}
    }
    
    if (request.setsCookies) {
        site.uniqueDomains[request.domain].setsCookies = true
    }

    site.requests.push(request)
}

module.exports = Site
