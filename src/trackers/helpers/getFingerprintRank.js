// Bucket fingerprint scores into a 0-3 scale.
// The cutoffs for each bucket were determined manually by looking
// at previous crawl data.
function getFingerprintRank (fp) {
    if (!fp) return 0

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

module.exports = getFingerprintRank
