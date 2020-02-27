const {taskGroups} = require('./lh/task-groups')
const MainThreadTasks = require('./lh/main-thread-tasks.js')

function getJavaScriptURLs(records) {
    /** @type {Set<string>} */
    const urls = new Set()
    for (const record of records) {
        if (record.type === 'Script') {
            urls.add(record.url)
        }
    }

    return urls
}

/**
 * @param {LH.Artifacts.TaskNode[]} tasks
 * @param {Set<string>} jsURLs
 * @return {Map<string, Object<string, number>>}
 */
function getExecutionTimingsByURL(tasks, jsURLs) {
    /** @type {Map<string, Object<string, number>>} */
    const result = new Map()

    for (const task of tasks) {
        const jsURL = task.attributableURLs.find(url => jsURLs.has(url))
        const fallbackURL = task.attributableURLs[0]
        let attributableURL = jsURL || fallbackURL
        // If we can't find what URL was responsible for this execution, just attribute it to the root page.
        if (!attributableURL || attributableURL === 'about:blank') {attributableURL = 'Other'}

        const timingByGroupId = result.get(attributableURL) || {}
        const originalTime = timingByGroupId[task.group.id] || 0
        timingByGroupId[task.group.id] = originalTime + task.selfTime
        result.set(attributableURL, timingByGroupId)
    }

    return result
}

async function analyzeTrace(trace, requests) {
    const tasks = await MainThreadTasks.request(trace, {computedCache: new Map()})

    const jsURLs = getJavaScriptURLs(requests)
    const executionTimings = getExecutionTimingsByURL(tasks, jsURLs)

    const thresholdInMs = 0

    let hadExcessiveChromeExtension = false
    const results = Array.from(executionTimings)
    .map(([url, timingByGroupId]) => {
        // Add up the totalExecutionTime for all the taskGroups
        let totalExecutionTimeForURL = 0
        for (const [groupId, timespanMs] of Object.entries(timingByGroupId)) {
            timingByGroupId[groupId] = timespanMs
            totalExecutionTimeForURL += timespanMs
        }

        const scriptingTotal = timingByGroupId[taskGroups.scriptEvaluation.id] || 0
        const parseCompileTotal = timingByGroupId[taskGroups.scriptParseCompile.id] || 0

        hadExcessiveChromeExtension = hadExcessiveChromeExtension ||
        (url.startsWith('chrome-extension:') && scriptingTotal > 100)

        return {
            url,
            total: totalExecutionTimeForURL,
            // Highlight the JavaScript task costs
            scripting: scriptingTotal,
            scriptParseCompile: parseCompileTotal,
        }
    })
    .filter(result => result.total >= thresholdInMs)
    .sort((a, b) => b.total - a.total)

    return results
}

module.exports = analyzeTrace