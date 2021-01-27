const cname = require('./../helpers/cname.js')
const {getExampleSites} = require('./../helpers/getExampleSites.js')
const sharedData = require('./../helpers/sharedData.js')

class CommonRequest {
    constructor (request, site) {
        this.host = request.domain
        this.rule = _escapeUrl(request)
        this.sites = 1
        this.pages = new Set().add(site.domain)

        // apis used. only counting one api call per page
        this.apis = Object.keys(request.apis).reduce((obj, key) => {obj[key] = 1; return obj}, {})

        this.type = request.type
        this.cookiesOn = request.setsCookies ? 1 : 0
        this.subdomains = request.data.subdomain ? new Set().add(request.data.subdomain) : new Set()
        this.fpPerSite = [request.fingerprintScore]

        // values calculated after processing all crawl sites
        this.fpAvg = 0
        this.prevalence = 0
        this.cookies = 0
        this.fpStd = 0
        this.fpAvg = 0
        this.cnames = request.wasCNAME ? [cname.createCnameRecord(request)] : []
        this.responseHashes = []

        this.firstPartyCookies = {}

        this.nameservers = request.nameservers
    }

    update (request, site) {
        _update(this, request, site)
    }

    finalize (totalSites) {
        _finalize(this, totalSites)
    }
}

function _escapeUrl (request) {
    let rule = request.domain
    if (request.path) {
        rule += request.path
    }

    return rule.replace(/(\(|\)|\/|\?|\.|\||\[)/g,'\\$1')
}

function _update (commonReq, newReq, site) {
    // update common request with new data only once for each site. If a site has 100s of requests
    // for tracker.js, we're only going to count one of them
    if (!commonReq.pages.has(site.host)) {
        commonReq.sites++
        commonReq.apis = _combineApis(commonReq.apis, newReq.apis)

        if (newReq.data.subdomain) {
            commonReq.subdomains.add(newReq.data.subdomain)
        }

        commonReq.pages.add(site.host)
        commonReq.fpPerSite.push(newReq.fingerprintScore)

        if (newReq.setsCookies) {
            commonReq.cookiesOn++
        }

        if (newReq.wasCNAME) {
            const record = cname.createCnameRecord(newReq)
            if (!cname.containsCnameRecord(commonReq.cnames, record)) {
                commonReq.cnames.push(record)
            }
        }


        if (newReq.responseHash && !commonReq.responseHashes.includes(newReq.responseHash)) {
            commonReq.responseHashes.push(newReq.responseHash)
        }
    }
}

function _combineApis (currApis, newApis) {
    for (const api in newApis) {
        if (currApis[api]) {
            currApis[api]++
        } else {
            currApis[api] = 1
        }
    }
    return currApis
}

function _finalize (request, totalSites) {
    // calclate the percent of sites the request is found on and percent of sites it sets cookies on
    request.cookies = Number(request.cookiesOn / totalSites)
    request.prevalence = Number(request.sites / totalSites)

    // calculate the average and standard deviation in fingerprint scores across all sites this request was found on
    const avg = request.fpPerSite.reduce((sum, val) => sum + val, 0) / request.fpPerSite.length
    const sumSquare = request.fpPerSite.reduce((sum, val) => sum + Math.pow(Math.abs(val - avg), 2), 0)

    request.fpAvg = avg
    request.fpStd = Math.sqrt(sumSquare / (request.fpPerSite.length - 1)) || 0

    delete request.fpPerSite

    request.exampleSites = getExampleSites([...request.pages], sharedData.config.includeExampleSites)
    delete request.pages
    
    request.subdomains = [...request.subdomains]
}

module.exports = CommonRequest
