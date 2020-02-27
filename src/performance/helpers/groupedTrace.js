const analyzeTrace = require('./analyzeTrace')

async function getGroupedTraceData(trace, requests) {
    let cpuPerUrl = null

    try {
        cpuPerUrl = await analyzeTrace(trace, requests)
    } catch (e) {
        throw new Error(`invalid trace - ${e.message}`)
    }

    const output = []

    cpuPerUrl.forEach(item => {
        // skip 'Other'
        if (item.url === 'Other') {
            return
        }

        const entry = {
            url: item.url,
            total: item.total,
            scripting: item.scripting,
            scriptParseCompile: item.scriptParseCompile
        }

        output.push(entry)
    })

    return output
}

module.exports = getGroupedTraceData
