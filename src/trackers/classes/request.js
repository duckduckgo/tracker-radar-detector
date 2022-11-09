const shared = require('./../helpers/sharedData.js')
const URL = require('./../helpers/url.js')
const getOwner = require('./../helpers/getOwner.js')
const {isFirstPartyCookie,isCookieValueInUrl} = require('./../helpers/cookies')
const tldts = require('tldts-experimental')
const {TLDTS_OPTIONS} = require('../helpers/const')

const COOKIE_LENGTH_CUTOFF = 5

class Request {
    constructor (reqData, site) {
        this.site = site
        this.extractURLData(reqData.url)
        this.type = reqData.type
        this.headers = reqData.responseHeaders || {}
        this.setsCookies = _setsCookies(this)
        this.isTracking = false
        this.fingerprintScore = _getFPScore(Object.keys(this.apis))
        // if this request uses a third party CNAME, keep data here
        this.wasCNAME = false
        this.originalSubdomain = undefined
        this.responseHash = reqData.responseBodyHash
        this.nameservers = []
        this.firstPartyCookies = site.thirdPartyJSCookies
            .filter(cookie => cookie.source === reqData.url && // cookie source is this request
                cookie.value && // cookie has a truthy value
                isFirstPartyCookie(cookie.domain, site.domain)) // cookie was set on the first party origin
        this.firstPartyCookiesSent = site.thirdPartyJSCookies
            .filter(cookie => {
                // only consider cookies 6 or more characters long
                return cookie.value &&
                    cookie.value.length > COOKIE_LENGTH_CUTOFF &&
                    isCookieValueInUrl(cookie, new URL(reqData.url))
            })
        this.initiator = _getInitiator(site.domain, reqData.url, reqData.initiators)
    }

    /**
     * Extract relevant data from the URL. Sets properties of object.
     * @param {string} url - the URL to analyze
     */
    extractURLData(url) {
        this.url = url
        this.data = new URL(url)
        this.domain = this.data.domain
        this.host = this.data.hostname
        this.path = this.path || this.data.path
        this.owner = getOwner(this.data.domain)
        this.apis = this.site.siteData.data.apis.callStats[url] || {}
    }
}

function _getFPScore (apis) {
    if (!apis.length) {return 0}

    return apis.reduce((totalFP, api) => {
        totalFP += shared.abuseScores[api] || 1
        return totalFP
    },0)
}

function _setsCookies (req) {
    if (req.apis['Document.cookie setter'] || req.apis['CookieStore.prototype.set'] || req.headers['set-cookie']) {
        return true
    }
    return false
}

/**
 * Returns hostname of first initiator which doesn't share eTLD+1 with the request.
 * 
 * @param {string} siteUrl
 * @param {string} reqUrl
 * @param {Array<string>} initiators 
 * @returns {string} eTLD+1 or "first party"
 */
function _getInitiator (siteUrl, reqUrl, initiators) {
    const siteUrlData = tldts.parse(siteUrl, TLDTS_OPTIONS)
    const reqUrlData = tldts.parse(reqUrl, TLDTS_OPTIONS)

    // site is the default initiator
    let finalInit = siteUrlData.isIp ? siteUrlData.host : siteUrlData.domain

    if (initiators.length) {
        for (const init of initiators) {
            const initUrlData = tldts.parse(init, TLDTS_OPTIONS)

            // first initiator in chain with a different eTLD+1 than the request
            if (reqUrlData.isIp ? reqUrlData.host !== initUrlData.host : reqUrlData.domain !== initUrlData.domain) {
                finalInit = initUrlData
                break
            }
        }
    }

    if (finalInit && (finalInit.isIp ? finalInit.host !== siteUrlData.host : finalInit.domain !== siteUrlData.domain)) {
        return finalInit.domain
    }
    
    // if site is the initiator normalize the value
    return 'first party'
}

module.exports = Request
