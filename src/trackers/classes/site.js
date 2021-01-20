const Request = require('./request.js')
const shared = require('./../helpers/sharedData.js')
const ParsedUrl = require('./../helpers/parseUrl.js')
const cnameHelper = require('./../helpers/cname.js')
const getOwner = require('./../helpers/getOwner.js')

class Site {
    constructor (siteData) {
        this.siteData = siteData

        const url = new ParsedUrl(siteData.initialUrl)
        this.host = url.hostname
        this.domain = url.domain
        this.subdomain = url.subdomain

        // unique 3p domains on this site with overall fingerprint score for each
        this.uniqueDomains = {}

        // unique 3p entities on the site. marking if they are tracking or not
        this.uniqueEntities = {}

        // cookies that were set on the site
        this.cookies = _getCookies(siteData)

        this.requests = []

        this.owner = getOwner(this.domain)

        this.isFirstParty = _isFirstParty.bind(this)

        this.cnameCloaks = {}

        this.analyzeRequest = _analyzeRequest.bind(this)
    }

    async processRequest (requestData) {
        await _processRequest(requestData, this)
    }

}

// Cookie data from the crawler has the domain and path split
// we will parse and combine those parts to get a single domain
function _getCookies (siteData) {
    return  siteData.data.cookies.reduce((cookieObj, cookie) => {
       // some domains will have a leading period we need to remove
        const cookieHost = new ParsedUrl(`http://${cookie.domain.replace(/^\./,'')}`).hostname
        cookieObj[`${cookieHost}${cookie.path}`]
        return cookieObj
    }, [])
}

/**
 * Test if the given URL is in this first party set.
 * @param {string} url - url to test against.
 * @returns {bool} True if the url is in this sites first party set.
 */
function _isFirstParty(url) {
    const data = new ParsedUrl(url)
    const dataOwner = getOwner(data.domain)
    if (data.domain === this.domain || ((dataOwner && this.owner) && dataOwner === this.owner)) {
        return true
    }
    return false
}

/**
 *  Analyze a site for tracking or fingerprinting behaviors
 *  @param {Request} request - The request object
 *  @param {Site} site - the current site object
 */
function _analyzeRequest(request, site) {
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

    if (request.wasCNAME) {
        site.uniqueDomains[request.domain].usesCNAMECloaking = true
    }
}

/**
 *  Determine if a request is for a root site, meaning the main site being
 *  visited. If navigating to login.microsoft.com, that would be only
 *  login.microsoft.com or whatever it is redirected to (for instance, with a 301)
 *  @param {Request Object} request - a Request object
 *  @param {Site} site - the current site object
 */
function isRootSite(request, site) {
    const isInitial = `${request.data.subdomain}.${request.data.domain}` === `${site.subdomain}.${site.domain}`
    const finalURL = site.siteData.finalUrl ? new ParsedUrl(site.siteData.finalUrl) : ''
    const isFinal = `${request.data.subdomain}.${request.data.domain}` === `${finalURL.subdomain}.${finalURL.domain}`
    return isInitial || isFinal
}

/**
 *  Process a single request, resolve CNAME's (if any)
 *  @param {Object} requestData - The raw request data
 *  @param {Site} site - the current site object
 */
async function _processRequest (requestData, site) {
    const request = new Request(requestData, site)

    if (!site.isFirstParty(request.url)) {
        const nameservers = await shared.nameservers.resolveNs(request.host)
        if (nameservers) {
            request.nameservers = nameservers
        }
    }

    // If this request is a subdomain of the site, see if it is cnamed
    if (site.isFirstParty(request.url) &&
        !shared.config.treatCnameAsFirstParty &&
        !isRootSite(request, site) &&
        !cnameHelper.isSubdomainExcluded(request.data)
        ) {
        const cnames = await cnameHelper.resolveCname(request.url)
        if(cnames) {
            for (const cname of cnames) {
                if (!site.isFirstParty(cname)) {
                    // console.log(`Third Party CNAME: ${request.data.subdomain}.${request.data.domain} -> ${cname}`)
                    const origSubDomain = request.data.subdomain + "." + request.data.domain
                    site.cnameCloaks[cname] = request.data.subdomain + "." + request.data.domain
                    request.extractURLData(cname)
                    request.wasCNAME = true
                    request.originalSubdomain = origSubDomain
                }
            }
        }
    }
   

    if (site.isFirstParty(request.url) && !shared.config.keepFirstParty) {
        return
    }

    site.analyzeRequest(request, site)
    site.requests.push(request)
}

module.exports = Site
