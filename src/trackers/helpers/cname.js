/**
 * Handle CNAME DNS lookups and common errors that we can safely ignore.
 */

const dns = require('dns').promises
const ParsedUrl = require('./parseUrl.js')

const cache = {}

/*
 * Attempt to look up a CNAME for a given hostname
 * @param {string} url - url to run the check on.
 *
 * @return {Promise} The cname resolution
 */
async function resolveCname(url) {
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
            e.message.includes("chrome-extension"))) {
            console.log(e)
            return undefined
        }
    }
    return cache[url.hostname]
}

module.exports = resolveCname