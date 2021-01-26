/**
 * Handle name server lookups
 */
const dns = require('dns').promises
const fs = require('fs')
const cache = {}

class NameServers {
    /**
     * Attempt to look name servers for a given hostname
     * @param {string} host - hostname to look up.
     *
     * @return {array} The name server resolution
     */
    static async resolveNs(host) {
        if (!host) {
            return undefined
        }

        if (host in cache) {
            return cache[host]
        }
       
        // New DNS NS request
        // Sites are processed in batches. It's possible for multiple NS requests to 
        // happen before the cache has a resolved NS response. Handle this by adding the unresolved 
        // promise to the cache so multiple requests for the same host can reference the 
        // same cache entry
        cache[host] = dns.resolveNs(host).catch(e => _handleNsError(e, host))

        return cache[host]
    }

    // helper to save cache file to disk
    static saveCache() {
        fs.writeFileSync('NS-cache.json', JSON.stringify(cache, null, 2))
    }

}

// Set cache result to empty list for no NS result
function _handleNsError (e, host) {
    if (e.message && (e.message.includes("ENODATA") || e.message.includes("ENOTFOUND"))) {
        if (!Array.isArray(cache[host])) {
            cache[host] = []
        }
    }
}

module.exports = NameServers
