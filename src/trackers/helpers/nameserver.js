/**
 * Handle nameserver lookups
 */
const dns = require('dns').promises
const shared = require('./sharedData.js')
const ParsedUrl = require('./parseUrl.js')
const fs = require('fs')
const cache = {}

class NameServers {
    /**
     * Attempt to look name servers for a given hostname
     * @param {string} url - url to run the check on.
     *
     * @return {Promise} The name server resolution
     */
    static async resolveNs(host) {
        if (!host) {
            return undefined
        }

        if (host in cache) {
            return await cache[host]
        }
        
        // New NS request, add promise to cache to avoid multiple requests for this host
        cache[host] = dns.resolveNs(host).catch(e => _handleNsError(e, host, cache))
        cache[host] = await cache[host]

        return cache[host]
    }

    // helper to save cache file to disk
    static saveCache() {
        fs.writeFileSync('NS-cache.json', JSON.stringify(cache, null, 2))
    }

}

// Set cache result to empty list for no NS result
function _handleNsError (e, host, cache) {
    if (e.message && (e.message.includes("ENODATA") || e.message.includes("ENOTFOUND"))) {
        if (!Array.isArray(cache[host])) {
            cache[host] = []
        }
    }
}

module.exports = NameServers
