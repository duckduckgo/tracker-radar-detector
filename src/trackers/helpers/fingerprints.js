// Bucket fingerprint scores into a 0-3 scale.
// The cutoffs for each bucket were determined manually by looking
// at previous crawl data.
function getFingerprintRank (fp) {
    if (!fp) {return 0}

    const logFp = Math.log(fp)
    let bucket = 0

    if (logFp > 6) {
        bucket = 3
    } else if (logFp > 3.5 && logFp <= 6) {
        bucket = 2
    } else if (logFp <= 3.5) {
        bucket = 1
    }

    return bucket
}

function getFingerprintWeights (crawl) {
    const apiWeights = {}
    let maxWeight = 0
    const setMaxWeight = []

    for (const [api, apiScores] of Object.entries(crawl.fpWeights.apis)) {
        const trackingWt = apiScores.tracking / crawl.fpWeights.scripts.tracking
        const nontrackingWt = apiScores.nontracking / crawl.fpWeights.scripts.nontracking

        // api is always used for tracking, set to highest weight we see
        if (nontrackingWt === 0) {
            setMaxWeight.push(api)
        } else {
            const weight = Number((trackingWt / nontrackingWt).toFixed(2))
            apiWeights[api] = weight

            if (weight > maxWeight) {
                maxWeight = weight
            }
        }
    }

    if (setMaxWeight.length) {
        setMaxWeight.forEach(api => {
            apiWeights[api] = maxWeight
        })
    }

    return apiWeights
}

module.exports = {
    getFingerprintRank,
    getFingerprintWeights
}
