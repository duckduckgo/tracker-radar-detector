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
            this.path = new urlParse.URL(url).pathname
        } catch(e) {
            console.warn(`\nSkipping unparsable url: ${url}`)
        }
    }

}

function manualCases (URL) {
    // regex key to correct domain value
    const cases = {
        ".*\\.amazonaws\\.com$" : 'amazonaws.com',
        ".*\\.cloudfront\\.net$" : 'cloudfront.net',
        ".*\\.googleapis.com$" : 'googleapis.com'
    }

    for (const [re, domain] of Object.entries(cases)) {
        if(URL.domain && URL.domain.match(re)) {
            //console.log(`manual domain ${URL.domain} to ${domain}`)
            URL.domain = domain
        }
    }
}

module.exports = URL
