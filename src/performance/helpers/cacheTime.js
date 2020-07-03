/**
 * Based on https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/audits/byte-efficiency/uses-long-cache-ttl.js
 */
const parseCacheControl = require('parse-cache-control')

/**
 * Return max-age if defined, otherwise expires header if defined, and null if not.
 * @param {Object<string, string>} headers
 * @param {ReturnType<typeof parseCacheControl>} cacheControl
 * @param {number} referenceTime
 * @return {?number}
 */
function computeCacheLifetimeInSeconds(headers, cacheControl, referenceTime) {
    if (cacheControl && cacheControl['max-age'] !== undefined) {
        return cacheControl['max-age']
    }

    const expiresHeaders = headers.expires
    if (expiresHeaders) {
        const expires = new Date(expiresHeaders).getTime()
        // Invalid expires values MUST be treated as already expired
        if (!expires) {return 0}
        return Math.ceil((expires - referenceTime) / 1000)
    }

    return null
}

/**
  * Returns true if headers suggest a record should not be cached for a long time.
  * @param {Object<string, string>} headers
  * @param {ReturnType<typeof parseCacheControl>} cacheControl
  * @returns {boolean}
  */
function cachingDisallowed(headers, cacheControl) {
    // The HTTP/1.0 Pragma header can disable caching if cache-control is not set, see https://tools.ietf.org/html/rfc7234#section-5.4
    if (!cacheControl && (headers.pragma || '').includes('no-cache')) {
        return true
    }

    // Ignore assets where policy implies they should not be cached long periods
    if (cacheControl && cacheControl['no-cache']) {
        return true
    }

    return false
}

/**
 * Returns allowed caching time in seconds.
 * 
 * @param {Object<string, string>} headers 
 * @param {number} referenceTime 
 */
function getCacheTimeFromHeaders(headers, referenceTime = Date.now()) {
    const cacheControl = parseCacheControl(headers['cache-control'])

    if (cachingDisallowed(headers, cacheControl)) {
        return 0
    }

    return computeCacheLifetimeInSeconds(headers, cacheControl, referenceTime)
}

module.exports = {
    getCacheTimeFromHeaders
}
