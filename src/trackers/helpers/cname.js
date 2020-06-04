/**
 * Handle CNAME DNS lookups and common errors that we can safely ignore.
 */

const dns = require('dns').promises
const ParsedUrl = require('./parseUrl.js')


const cache = {}

class CNAME {
    /*
     * Attempt to look up a CNAME for a given hostname
     * @param {string} url - url to run the check on.
     *
     * @return {Promise} The cname resolution
     */
    static async resolveCname(url) {
        url = ParsedUrl.parse(url)
        if (url.hostname in cache) {
            return cache[url.hostname]
        }
        if (url.protocol.startsWith("chrome-extension")) {
            return undefined
        }
        try {
            let cname = await dns.resolveCname(url.hostname)
            cache[url.hostname] = cname
        } catch (e) {
            if (e.message && !(
                e.message.includes("ENODATA") ||
                e.message.includes("ENOTFOUND"))) {
                console.log(e)
                return undefined
            }
        }
        return cache[url.hostname]
    }

    /**
     * Determine if a given record is in the list of records.
     * @param {list} cnameRecords - list of cname record objects.
     * @param {Object} record - a cname record object.
     * @returns {bool} True if record is contained in the list
     */
    static containsCnameRecord(cnameRecords, record) {
        for (let cReq of cnameRecords) {
            if (cReq.original === record.original && cReq.resolved === record.resolved) {
                return true
            }
        }
        return false
    }

    /**
     * Create a CNAME record from a Request
     * @param {Object} request - a Record object.
     * @returns {Object} a cname object.
     */
    static createCnameRecord(request) {
        return {
            "original": request.originalSubdomain,
            "resolved": request.data.subdomain + "." + request.data.domain
        }
    }
}

module.exports = CNAME