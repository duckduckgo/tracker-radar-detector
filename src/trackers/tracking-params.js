const fs = require('fs')
const URL = require('./helpers/url.js')
const config = require('../../config.json')
const getOwner = require('./helpers/getOwner.js')

// read file list, shuffle, and option to slice into a smaller list of testing
const files = _shuffleList(fs.readdirSync(config.crawlerDataLoc))
const cookieParser = require('cookie')

// collect url params seen in initialUrl
const crawlParams = {
    params: [],
    paramString: ''
}

// The crawl can include an optional false positive parameter, assumed to be called 'not_a_param'. This 
// is useful to help filter out cases where a site uses the entire param string in requests and cookies. 
// The first value in the list is the expected param, the others are altered versions that were found in manual testing.
const falsePositiveParams = ['not_a_param', 'a_param', 'notaparam', 'not_a', 'not%20a%20param', 'not a param']

// Results object will store our final param data. The format is
// {
//    <param> : {
//          prevalence: percent of totalSites that the param was seen on
//          exampleSites: list of top sites using the param in cookies or requests
//          cookies: 
//              firstParty: count of first party cookies this param was seen in
//              thirdParty: count of third party cookies this param was seen in
//              prevalence: percent of totalSites where the param was set in a cookie
//              entities: top 10 entities using this param in cookies
//              domains: top 10 domains using this param in cookies
//          requests3p:
//              prevalence: percent of totalSites where the param was seen in a third party request
//              entities: top 10 entities using this param in requests
//              domains: top 10 domains using this param in requests
//    }
const results = {}
let totalSites = 0

function run () {
    files.forEach(fileName => {
        const siteData = JSON.parse(fs.readFileSync(`${config.crawlerDataLoc}/${fileName}`, 'utf8'))

        if (!siteData.initialUrl) {
            return
        }

        const siteUrl = new URL(siteData.initialUrl)

        if (!siteUrl.searchParams) {
            return
        }

        // set the global crawlParams off of the first parameter string we see
        if (!crawlParams.paramString) {
            setCrawlParams(siteUrl)
        }

        processRequests(siteData, siteUrl)
        processCookies(siteData, siteUrl)
        
        totalSites++
    })


    cleanupFinalData(results)
    fs.writeFileSync(`${config.trackerDataLoc}/build-data/generated/tracking_parameters.json`, JSON.stringify({totalSites, params: results}, null, 4))

}
run()


// Look though the site 'call.arguments' data, count first and third party cookies
function processCookies (siteData, siteUrl) {
    if (!siteData.data?.apis?.savedCalls) {
        return
    }

    siteData.data.apis.savedCalls.forEach(call => {
        
        if (!(call.arguments && call.arguments.length)) {
            return
        }

        if (typeof call.arguments === 'string') {
            call.arguments = JSON.parse(call.arguments)
        }

        // find matching param and args. Don't count args that match all parameters, these are just the full param strings
        call.arguments.forEach(arg => {
            const argMatches = []
            for (const [param, value] of crawlParams.params.entries()) {
                if (arg.includes(value) && !hasFalsePositiveMatch(arg)) {
                    argMatches.push({arg, param})
                }
            }

            // skip args that matched all params
            if (argMatches.length && argMatches.length !== crawlParams.params.length) {
                argMatches.forEach(match => {
                    countCookies(match.arg, siteUrl, match.param)
                })
            }
        })
    })
}

function processRequests (siteData, siteUrl) {
    if (!siteData.data.requests) {
        return
    }

    const siteOwner = getOwner(siteUrl.domain)

    siteData.data.requests.forEach(req => {
        let requestUrl
        try {
            requestUrl = new URL(req.url)
        } catch (e) {
            console.log(e)
            return
        }

        let requestOwner  = getOwner(requestUrl.domain)

        // skip first party and same entity
        if (requestUrl.hostname === siteUrl.hostname || (siteOwner && (siteOwner === requestOwner))) {
            return
        }

        // process request paths, skip any that match one of the false positive parameters
        if (requestUrl.pathname && !(hasFalsePositiveMatch(requestUrl.pathname) ||
            requestUrl.pathname.includes(crawlParams.paramString) ||
            requestUrl.pathname.includes(crawlParams.paramStringEncoded))
        ) {

            for (const [fakeParamKey, fakeParamValue] of crawlParams.params.entries()) {
                const pathMatch = requestUrl.pathname.includes(fakeParamValue)
                if (pathMatch) {
                    countRequests(pathMatch[0], siteData.initialUrl, fakeParamKey, siteData.initialUrl)
                    
                    //fallback to requestUrl if we don't know the owner
                    if (!requestOwner) {
                        requestOwner = requestUrl.hostname
                    }
                    countEntities(requestUrl, fakeParamKey, requestOwner, 'requests3p')
                    countDomains(requestUrl, fakeParamKey, requestUrl.domain, 'requests3p')
                }
            }
        }

        // process request parameters
        for (const [key, val] of requestUrl.searchParams.entries()) {
            if (!(key && val)) {
                continue
            }

            // skip any value that has an exact match to our full param string. this will miss values that contain the full param string and
            // additional fake parameters added in. i.e  tracker.com/?fakeKey=fakeVal&extraTrackyParam=fakeval
            if (val.includes(crawlParams.paramString) || val.includes(crawlParams.paramStringEncoded)) {
                continue
            }

            for (const [fakeParamKey, fakeParamValue] of crawlParams.params.entries()) {
                if (val.includes(fakeParamValue) && !hasFalsePositiveMatch(val)) {
                    countRequests(`${key}=${val}`, siteData.initialUrl, fakeParamKey, siteUrl)
                    
                    //fallback to requestUrl if we don't know the owner
                    if (!requestOwner) {
                        requestOwner = requestUrl.hostname
                    }

                    countEntities(requestUrl, fakeParamKey, requestOwner, 'requests3p')
                    countDomains(requestUrl, fakeParamKey, requestUrl.domain, 'requests3p')
                }
            }
        }

    })
}

// see if the false postive param matches
function hasFalsePositiveMatch (paramValue) {
    for (const fpVal of falsePositiveParams) {
        if (paramValue.includes(fpVal)) {
            return true
        }
    }
    return false
}

function getPlaceholder () {
    return {
        prevalence: 0,
        exampleSites: [],
        requests3p: {
            prevalence: 0,
            entities: {},
            domains: {},
            requestSites: [],
            requestValues: {}
        },
        cookies: {
            prevalence: 0,
            firstParty: 0,
            thirdParty: 0,
            entities: {},
            domains: {},
            cookieSites: [],
            cookieValues: {}
        }
    }
}

// Count first and third party cookies
function countCookies (cookie, siteUrl, param) {
    if (!results[param]) {
        results[param] = getPlaceholder()
    }

    results[param].cookies.cookieValues[cookie] ? results[param].cookies.cookieValues[cookie]++ : results[param].cookies.cookieValues[cookie] = 1

    const siteKey = siteUrl.hostname + siteUrl.path

    if (!results[param].cookies.cookieSites.includes(siteKey)) {
        results[param].cookies.cookieSites.push(siteKey)
        results[param].cookies.prevalence++
    }

    // look for 1p 3p cookies
    const parsedCookie = cookieParser.parse(cookie)
    if (parsedCookie.domain) {
        parsedCookie.domain = parsedCookie.domain.replace(/^\./, '')

        // same domain and 'auto' cookie are 1p
        if (!(siteUrl.domain === parsedCookie.domain || siteUrl.domain.endsWith('.' + parsedCookie.domain) || parsedCookie.domain === 'auto')) {
            results[param].cookies.thirdParty++
            // count entities for 3p cookies
            let cookieDomainUrl = ''
            try {
                cookieDomainUrl = new URL(`http://${parsedCookie.domain.replace(/^\./, '')}`)
            } catch (e) {
                if (!e.message.includes('Invalid character')) {
                    console.log(parsedCookie)
                    console.log(e)
                }
            }

            const cookieOwner = getOwner(cookieDomainUrl.domain)
            countEntities(siteUrl, param, cookieOwner || cookieDomainUrl.hostname, 'cookies')
            countDomains(siteUrl, param, parsedCookie.domain, 'cookies')
        } else {
            results[param].cookies.firstParty++
        }
    }

    if (!results[param].exampleSites.includes(siteKey)) {
        results[param].exampleSites.push(siteKey)
    }
}

// Count unique third party requests
function countRequests (reqKey, site, param, siteUrl) {
    if (!results[param]) {
        results[param] = getPlaceholder()
    }

    const siteKey = siteUrl.hostname + siteUrl.path

    // collect all requests
    results[param].requests3p.requestValues[reqKey] ? results[param].requests3p.requestValues[reqKey]++ : results[param].requests3p.requestValues[reqKey] = 1

    if (!results[param].requests3p.requestSites.includes(siteKey)) {
        results[param].requests3p.requestSites.push(siteKey)
        results[param].requests3p.prevalence++
    }

    if (!results[param].exampleSites.includes(siteKey)) {
        results[param].exampleSites.push(siteKey)
    }
}

// count entities that set cookies or use url params
function countEntities (url, param, entity, key) {
    if (entity) {
        results[param][key].entities[entity] ? results[param][key].entities[entity]++ : results[param][key].entities[entity] = 1
    }
}

// count domains that set cookies or use url params
function countDomains (url, param, domain, key) {
    if (domain) {
        results[param][key].domains[domain] ? results[param][key].domains[domain]++ : results[param][key].domains[domain] = 1
    }
}

// crawl params are set off the first site we process. crawl params are assumed to be the same for all sites in the crawl. 
function setCrawlParams (site) {
    // check that parm string includes false positive param
    if (!site.searchParams.has(falsePositiveParams[0])) {
        return
    }

    if (!crawlParams.paramString) {
        crawlParams.params = site.searchParams
    }

    // set the param string 
    if (!crawlParams.paramString && site && site.search) {
        crawlParams.paramString = site.search.replace(/^\?/, '')
        crawlParams.paramStringEncoded = encodeURIComponent(crawlParams.paramString)
    }
}

// Cleanup the final data
// - remove request and cookie sites/values
// - calculate prevalence 
// - get a list of top entities
// - remove false positive param
function cleanupFinalData () {
    let topExampleSites = ''
    if (config.topExampleSites) {
        topExampleSites = new Set(JSON.parse(fs.readFileSync(config.topExampleSites, 'utf-8')))
    }

    for (const param of Object.keys(results)) {
        if (results[param].cookies) {
            delete results[param].cookies.cookieSites
            delete results[param].cookies.cookieValues
        }

        if (results[param].requests3p) {
            delete results[param].requests3p.requestSites
            delete results[param].requests3p.requestValues
        }

        results[param].prevalence = +(results[param].exampleSites.length / totalSites).toFixed(3)
        results[param].requests3p.prevalence = +(results[param].requests3p.prevalence / totalSites).toFixed(3)
        results[param].cookies.prevalence = +(results[param].cookies.prevalence / totalSites).toFixed(3)

        // calculate percents for entities
        results[param].cookies.entities = getTopEntries(results[param].cookies.entities)
        results[param].cookies.domains = getTopEntries(results[param].cookies.domains)
        results[param].requests3p.entities = getTopEntries(results[param].requests3p.entities)
        results[param].requests3p.domains = getTopEntries(results[param].requests3p.domains)

        if (topExampleSites) {
            const topParamSites = getTopExampleSites(results[param].exampleSites, topExampleSites)
            results[param].exampleSites = _shuffleList(topParamSites, 10).map(x => x.replace(/\/$/, ''))
        } else {
            results[param].exampleSites = _shuffleList(results[param].exampleSites, 10).map(x => x.replace(/\/$/, ''))
        }


    }
    
    if (results[falsePositiveParams[0]]) {
        delete results[falsePositiveParams[0]]
    }
}

// get top entries form key:val object
function getTopEntries(entries, numberOfEntries=10) {
    const sortedList = Object.entries(entries).sort((a,b) => {return b[1] - a[1]})

    // total for all entities used to calculate percent
    const total = sortedList.reduce((sum, e) => {
        sum += e[1]
        return sum
    }, 0)

    return sortedList.slice(0, numberOfEntries - 1).reduce((obj, e) => {
        obj[e[0]] = +(e[1] / total).toFixed(3)
        return obj
    }, {})
}

// Helper function to randomly shuffle a list and return an optional slice
function _shuffleList (list, numResults) {
    let shuffledList = list.map(val => ({val, sort: Math.random()}))
        .sort((a, b) => a.sort - b.sort)
        .map(({val}) => val)

    if (numResults) {
        shuffledList = shuffledList.slice(0,numResults)
    }

    return shuffledList
}

// Intersection between parameter sites and topExampleSites
function getTopExampleSites (paramSites, topSitesSet) {
    return paramSites.filter(url => {
        const x = new URL('http://' + url)
        return topSitesSet.has(x.domain)
    })
}
