// parse a URL using a few different packages since none give us all the info that we want
const tldjs = require('tldjs')
const tldts = require('tldts')
const urlParse = require('url')

class URL {
    constructor (url) {
        url = url.replace(/^blob:/, '')
        
        const tldObj = tldjs.parse(url)
        const tldsObj = tldts.parse(url, {allowPrivateDomains: false})

        if (tldsObj.isIp) {
            this.domain = tldsObj.host
        } else {
            this.domain = tldsObj.domain || tldObj.domain
        }

        manualCases(this)

        this.hostname = tldObj.hostname || tldsObj.host
        this.subdomain = tldObj.subdomain || tldsObj.subdomain
        try {
            const urlData = URL.parse(url)
            this.path = urlData.pathname
        } catch(e) {
            console.warn(`\nSkipping unparsable url: ${url}`)
        }
    }

    /**
     * Format and parse the URL. In cases where the scheme is missing attempt to guess it.
     * @param {string} url - url to parse
     * @return {urlParse.URL} The parsed URL
     */
    static parse(url) {
        let urlData
        try {
            urlData = new urlParse.URL(url)
        } catch (e) {
            if (e instanceof TypeError) {
                urlData = new urlParse.URL("http://" + url)
            } else {
                console.log(`error for ${url}`)
                throw e
            }
        }
        return urlData
    }

}

function manualCases (url) {
    // regex key to correct domain value
    const cases = {
        ".*\\.amazonaws\\.com$": 'amazonaws.com',
        ".*\\.cloudfront\\.net$": 'cloudfront.net',
        ".*\\.googleapis.com$": 'googleapis.com'
    }

    for (const [re, domain] of Object.entries(cases)) {
        if(url.domain && url.domain.match(re)) {
            //console.log(`manual domain ${url.domain} to ${domain}`)
            url.domain = domain
        }
    }
}

module.exports = URL
