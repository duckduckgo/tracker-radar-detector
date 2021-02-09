const {getDomain} = require('tldts-experimental')

/**
 * Returns true iff this savedCall is a valid call to document.cookie
 * @param {Object} savedCall data
 */
function isSavedCookieSetterCall({description, arguments: args}) {
    return description === 'Document.cookie setter' &&
                typeof args !== 'boolean' &&
                args.length > 0 &&
                typeof args[0] === 'string'
}

/**
 * Parse a cookie string as passed to document.cookie setter and extract its attributes
 * @param {string} cookieString 
 */
function parseCookie(cookieString) {
    const parsed = cookieString.split(';').map(pair => pair.split('=', 2).map(s => s.trim()))
    return parsed.reduce((info, [k, v], i) => {
        if (i === 0) {
            info.name = k
            info.value = v
        } else if (k) {
            info[k.toLowerCase()] = v
        }
        return info
    }, {})
}

/**
 * Calculate the cookie time to live, given the timestamp when the cookie was set.
 * @param {Object} cookie - parsed cookie
 * @param {Number} setAtTs - timestamp in ms when the cookie was set
 * @returns TTL of this cookie in seconds from setAtTs.
 */
function calculateCookieTtl(cookie, setAtTs) {
    if (cookie['max-age']) {
        return parseInt(cookie['max-age'], 10)
    }
    return Math.floor((new Date(cookie.expires).getTime() - setAtTs) / 1000)
}

/**
 * Given a cookie set on a site, returns true if this cookie was set on the 1st party
 * @param {string} cookieDomain domain attribute of the cookie
 * @param {string} siteGeneralDomain eTLD+1 of the 1st party website
 * @returns {boolean}
 */
function isFirstPartyCookie(cookieDomain, siteGeneralDomain) {
    // if the cookie has no domain attribute it is by default set on the host of the current
    // document URL
    if (!cookieDomain) {
        return true
    }
    // a leading '.' in the domain is ignored in the current spec
    const cleanCookieDomain = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain
    return siteGeneralDomain === cleanCookieDomain || siteGeneralDomain === getDomain(cleanCookieDomain)
}

/**
 * Set of handlers for apply custom search logic for specific cookies.
 * e.g. for _ga cookies only the suffix is generally sent, so this handler will only use this part
 * when searching for the cookie in a URL.
 */
const cookieHandlers = [{
    canHandle: ({name}) => name === '_ga',
    getValueSearchString: ({value}) => value.slice(6),
}, {
    canHandle: () => true,
    getValueSearchString: ({value}) => value,
}]
/**
 * Look for the value of a cookie in a URL. Returns true iff it is found, false otherwise.
 * @param {*} cookie Parsed cookie
 * @param {URL} url to check against
 */
function isCookieValueInUrl(cookie, url) {
    const handler = cookieHandlers.find(h => h.canHandle(cookie))
    const cookieValue = handler.getValueSearchString(cookie)
    return url.pathname.indexOf(cookieValue) !== -1 || url.search.indexOf(cookieValue) !== -1
}

module.exports = {
    isSavedCookieSetterCall,
    parseCookie,
    calculateCookieTtl,
    isFirstPartyCookie,
    isCookieValueInUrl,
}
