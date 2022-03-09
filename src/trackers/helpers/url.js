const {URL} = require('@cliqz/url-parser')
const {parse} = require('tldts-experimental')
const {TLDTS_OPTIONS} = require('./const')
const config = require('./../../../config.json')
const pslExtras = config.pslExtras ? require(config.pslExtras) : {}

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

            if (pslExtras) {
                // reformat private psl
                if (pslExtras.privatePSL.includes(this._domainInfo.domain)) {
                    const splitSubdomain = this._domainInfo.subdomain.split('.')
                    const domainWithoutSuffix = splitSubdomain.pop()
                    this._domainInfo.publicSuffix = this._domainInfo.domain
                    this._domainInfo.domain = `${domainWithoutSuffix}.${this._domainInfo.domain}`
                    this._domainInfo.domainWithoutSuffix = domainWithoutSuffix
                    this._domainInfo.subdomain = splitSubdomain.join('.')
                    this._domainInfo.isPrivate = true
                }
            }
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
