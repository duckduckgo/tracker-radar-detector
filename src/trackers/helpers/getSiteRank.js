const sharedData = require('./sharedData.js')

// get site ranking relative to siteRanks list. Most popular site
// gets rank equal to lenght of the list, second most popular length-1 etc
function getSiteRank (domain) {
    if (!(domain && sharedData.siteRanks)) {
        return
    }

    // look for hostname rank or domain, but hostname is prefered
    let rank = sharedData.siteRanks.indexOf(domain.hostname)

    if (rank === -1) {
        const domainRank = sharedData.siteRanks.indexOf(domain.hostname)
        if (domainRank === -1) {
            return 0
        } else {
            rank = domainRank
        }
    }

    return sharedData.siteRanks.length - (1- rank)
}

// get common request weighted rank based off the rakings of 
// all sites it was found on
function getWeightedRank (commonReq) {

    // sum of all sites ranks a request was on.
    return commonReq.siteRanks.reduce((total, rank) => {
        total += rank
        return total
    }, 0)
}

module.exports = {
    getSiteRank,
    getWeightedRank
}
