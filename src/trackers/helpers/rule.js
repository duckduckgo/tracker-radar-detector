const sharedData = require('./sharedData.js')

// Adds example sites for each rule if enabled in the config file
// Half of the sites can be chosen from a top sites list provided in the config. 
// The other half are randomly chosen form the list of sites a request was found on
function getExampleSites (sites, limit) {
    if (sites.length <= limit) {
        return sites
    }

    const idxList = []

    // half of the list is topExampleSites if given
    if (sharedData.topExampleSitesSet) {
        const intersection = sites.filter(x => sharedData.topExampleSitesSet.has(x))
        intersection.slice(0, Math.floor(limit/2)).map(domain => idxList.push(sites.indexOf(domain)))
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
    if (indexList.includes(idx)) {
        return _getRandomIndex(sourceList, indexList)
    }
    return idx
    
}

module.exports = {
    getExampleSites
}
