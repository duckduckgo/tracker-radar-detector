// parse a URL using a few different packages since none give us all the info that we want
const tldjs = require('tldjs')
const tldts = require('tldts')
const urlParse = require('url')

class URL {
    constructor (url) {
        url = url.replace(/^blob:/, '')
        
        const tldObj = tldjs.parse(url)
        const tldsObj = tldts.parse(url, {allowPrivateDomains: true})

        if (tldsObj.isIp) {
            this.domain = tldsObj.host
        } else {
            this.domain = tldsObj.domain || tldObj.domain
        }

        this.hostname = tldObj.hostname || tldsObj.host
        this.subdomain = tldObj.subdomain || tldsObj.subdomain
        try {
          const urlData = URL.parse(url)
          this.path = urlData.pathname
        } catch(e) {
            console.warn(`\nSkipping unparsable url: ${url}`)
        }
    }

    /*
     * Format and parse the URL. In cases where the scheme is missing
     * attempt to guess it.
     * @param {string} url - url to parse
     *
     * @return {urlParse.URL} The parsed URL
     */
    static parse(url) {
        let urlData
        try {
            urlData = new urlParse.URL(url)
        } catch (e) {
            if (e instanceof TypeError) {
                urlData = new urlParse.URL("http://" + url)
            }
            else {
                console.log(`error for ${url}`)
                throw e
            }
        }
        return urlData
    }

}

module.exports = URL
