const sharedData = require('./sharedData.js')
const tldts = require('tldts')

// Adds example sites for each rule if enabled in the config file
// Half of the sites can be chosen from a top sites list provided in the config. 
// The other half are randomly chosen form the list of sites a request was found on
function getExampleSites (sites, limit) {
    // remove IPs from example site list, if any
    sites = sites.filter(site => {
        if (!site) {
            return false
        }
        const parsedSite = tldts.parse(site)
        return !parsedSite.isIp
    })

    if (sites.length <= limit) {
        return sites
    }

    const idxList = []

    // half of the list is topExampleSites if given
    if (sharedData.topExampleSitesSet) {
        sites
            .filter(x => sharedData.topExampleSitesSet.has(x))
            .slice(0, Math.floor(limit/2))
            .forEach(domain => idxList.push(sites.indexOf(domain)))
    }

    const sitesToAdd = limit - idxList.length

    for (let i = 0; i < sitesToAdd; i++) {
        idxList.push(_getRandomIndex(sites, idxList))
    }

    const exampleSites = idxList.map(idx => sites[idx])

    return exampleSites
}

// get unique random indicies from the source list
function _getRandomIndex (sourceList, indexList) {
    const idx = Math.floor(Math.random() * sourceList.length)

    // skip sites already in the example list
    if (indexList.includes(idx)) {
        return _getRandomIndex(sourceList, indexList)
    }
    return idx
    
}

module.exports = {
    getExampleSites
}
