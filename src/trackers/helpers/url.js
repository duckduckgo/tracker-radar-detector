const {URL} = require('@cliqz/url-parser')
const fs = require('fs')
const {parse} = require('tldts-experimental')
const {TLDTS_OPTIONS} = require('./const')
const config = require('./../../../config.json')
const pslExtras = config.pslExtras ? JSON.parse(fs.readFileSync(config.pslExtras, 'utf8')) : {}

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

            if (!this._domainInfo.isPrivate && pslExtras && pslExtras.privatePSL) {
                // get list of possible suffix matches, we can have multiple matches for a single request
                // a.example.com and b.a.example.com for a request from 123.b.a.example.com
                // check that suffix is preceded by a dot or is at the beginning of the hostname
                const suffixMatches = pslExtras.privatePSL.filter(suffix => {
                    const escapedSuffix = suffix.replace('.', '\\.')
                    const regex = new RegExp(`(^|\\.)${escapedSuffix}$`)
                    return regex.test(this._domainInfo.hostname)
                })

                // reformat domainInfo to make this request look like a private domain
                if (suffixMatches && suffixMatches.length) {

                    // use most specific suffix match (longest)
                    const suffix = suffixMatches.reduce((l,s) => {
                        return l.length >= s.length ? l : s
                    })

                    // Array of subdomain after removing suffix from hostname
                    const splitSubdomain = this._domainInfo.hostname.replace(new RegExp(`\\.?${suffix}$`), '').split('.')
                    const domainWithoutSuffix = splitSubdomain.pop()

                    this._domainInfo.publicSuffix = suffix
                    this._domainInfo.domain = domainWithoutSuffix ? `${domainWithoutSuffix}.${suffix}` : suffix
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
