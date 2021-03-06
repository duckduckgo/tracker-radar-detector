const {URL} = require('@cliqz/url-parser')
const {parse} = require('tldts-experimental')
const {TLDTS_OPTIONS} = require('./const')


class ParsedURL extends URL {

    constructor(url) {
        if (url.startsWith('blob:')) {
            url = url.replace(/^blob:/, '')
        }
        super(url)
    }

    get domainInfo() {
        // extend domainInfo to use PSL 
        if (!this._domainInfo) {
            this._domainInfo = parse(this.hostname, {
                extractHostname: false,
                ...TLDTS_OPTIONS
            })
        }
        return this._domainInfo
    }

    /**
     * The eTLD+1 of this URL's hostname, or the IP address if the hostname is an IP
     */
    get domain() {
        return this.domainInfo.isIp ? this.hostname : this.domainInfo.domain
    }

    get subdomain() {
        return this.domainInfo.subdomain
    }

    /**
     * Cut any parameter string from the URL path
     */
    get path() {
        const pathname = this.pathname
        return pathname.split(';')[0]
    }
}

module.exports = ParsedURL
