const shared = require('./../helpers/sharedData.js')
const ParsedUrl = require('./../helpers/parseUrl.js')

class Request {
    constructor (reqData, site) {
        this.url = reqData.url
        this.type = reqData.type
        this.data = new ParsedUrl(this.url)
        this.domain = this.data.domain
        this.host = this.data.hostname
        this.path = this.data.path
        this.searchParams = this.data.searchParams.keys()

        this.owner = _getRequestOwner(this.data.domain)

        this.headers = reqData.responseHeaders || {}

        if (site.siteData.apis.callStats) {
            this.apis = site.siteData.data.apis.callStats[this.url] || {}
        } else {
            this.apis = site.siteData.data.apis[this.url] || {}
        }

        this.setsCookies = _setsCookies(this)

        this.isTracking = false
        this.fingerprintScore = _getFPScore(Object.keys(this.apis))

        this.isFirstParty = _isFirstParty(this, site)
    }
}

function _getRequestOwner (domain) {
    return shared.entityMap.get(domain)
}

function _getFPScore (apis) {
    if (!apis.length) {return 0}

    return apis.reduce((totalFP, api) => {
        totalFP += shared.abuseScores[api] || 1
        return totalFP
    },0)
}

function _isFirstParty (req, site) {
    if (req.domain === site.domain || ((req.owner && site.owner) && req.owner === site.owner)) {
        return true
    }
    return false

}

function _setsCookies (req) {
    if (req.apis['Document.cookie setter'] || req.headers['set-cookie']) {
        return true
    }
    return false

}

module.exports = Request
