const shared = require('./../helpers/sharedData.js')
const URL = require('./../helpers/url.js')
const getOwner = require('./../helpers/getOwner.js')
const {isFirstPartyCookie} = require('./../helpers/cookies')

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
        this.firstPartyCookies = site.documentCookies
            .filter(cookie => cookie.source === reqData.url && // cookie source is this request
                cookie.value && // cookie has a truthy value
                isFirstPartyCookie(cookie.domain, site.domain)) // cookie was set on the first party origin
        this.firstPartyCookiesSent = site.documentCookies
            .filter(cookie => {
                // only consider cookies 6 or more characters long
                if (cookie.value && cookie.value.length > COOKIE_LENGTH_CUTOFF) {
                    // for longer cookie values, exclude the first 6 characters (GA cookies only send the suffix)
                    const cookieSuffix = cookie.value.length > 10 ? cookie.value.slice(6) : cookie.value
                    return this.url.indexOf(cookieSuffix) !== -1
                }
                return false
            })
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
    if (req.apis['Document.cookie setter'] || req.headers['set-cookie']) {
        return true
    }
    return false
}

module.exports = Request
