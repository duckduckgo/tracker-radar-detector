const sharedData = require('./sharedData.js')

// get site ranking relative to siteRanks list. Most popular site
// gets rank equal to lenght of the list, second most popular length-1 etc
function getSiteRank (parsedUrl) {
    if (!(parsedUrl && sharedData.siteRanks)) {
        return
    }

    let rank = sharedData.siteRanks.indexOf(parsedUrl.domain)

    if (rank === -1) {
        return 1
    }

    return sharedData.siteRanks.length - rank
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
