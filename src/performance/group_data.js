#!/usr/bin/env node
/**
 * @file This script goes through the crawl files and groups performance stats per 3rd party TLD.
 */

const fs = require('fs')
const path = require('path')
const chalk = require('chalk').default
const ProgressBar = require('progress')
const {getCacheTimeFromHeaders} = require('./helpers/cacheTime')
const METADATA_FILE_NAME = 'metadata.json'
const tldts = require('tldts-experimental')
const math = require('d3-array')
const getGroupedTraceData = require('./helpers/groupedTrace')
const config = require('./../../config.json')

const dataDir = config.performanceDataLoc
console.log(`Reading crawl from: ${dataDir}`)

const dataFiles = fs.readdirSync(dataDir)
    .filter(file => {
        const resolvedPath = path.resolve(process.cwd(), `${dataDir}/${file}`)
        const stat = fs.statSync(resolvedPath)

        return stat && stat.isFile() && file.endsWith('.json') && file !== METADATA_FILE_NAME
    })

const progressBar = new ProgressBar('[:bar] :percent ETA :etas :file', {
    complete: chalk.green('='),
    incomplete: ' ',
    total: dataFiles.length,
    width: 30
})

async function main() {
    /**
     * Performance stats from all crawl files for third party resoruced grouped per domain.
     * @type {Map<string,GlobalStats>}
     */
    const groupped = new Map()

    let noTime = 0
    let hasTime = 0
    let noSize = 0
    let hasSize = 0
    let noCPU = 0
    let hasCPU = 0
    let noHeaders = 0
    let hasHeaders = 0

    const promises = dataFiles.map(async file => {
        progressBar.tick({file})

        const resolvedPath = path.resolve(process.cwd(), `${dataDir}/${file}`)
        let data = null

        try {
            const dataString = fs.readFileSync(resolvedPath, 'utf8')
            data = JSON.parse(dataString)
        } catch (e) {
            return
        }

        const crawlStarted = data.testStarted
        /**
         * @type {Array<Request>}
         */

        const requests = data.data.requests
        const trace = data.data.trace
        let cpuPerformanceData = null

        if (trace) {
            try {
                cpuPerformanceData = await getGroupedTraceData(trace, requests)
            } catch (e) {
                console.warn(`${file} contains invalid trace data (${e.message}).`)
            }
        }

        /**
         * Performance stats from current crawl file for third party resoruced grouped per domain.
         * @type {Map<string,LocalStats>}
         */
        const locallyGroupped = new Map()

        requests.forEach(request => {
            const urlObj = tldts.parse(request.url, {allowPrivateDomains: true})
            const index = urlObj.domain
            
            const grouppedEntry = locallyGroupped.get(index) || {time: [], size: [], cache: [], cpu: []}

            if (request.responseHeaders) {
                hasHeaders++
                let cacheTime = getCacheTimeFromHeaders(request.responseHeaders, crawlStarted) || 0
                // negative number can be caused e.g. by 'expires' headers with a past date
                cacheTime = cacheTime < 0 ? 0 : cacheTime

                grouppedEntry.cache.push(cacheTime)
            } else {
                noHeaders++
            }

            if (request.time === undefined) {
                noTime++
            } else {
                hasTime++
                grouppedEntry.time.push(request.time)
            }

            if (request.size === undefined) {
                noSize++
            } else {
                hasSize++
                grouppedEntry.size.push(request.size)
            }

            if (cpuPerformanceData) {
                const perf = cpuPerformanceData.find(d => d.url === request.url)

                if (perf) {
                    grouppedEntry.cpu.push(perf.total)
                    hasCPU++
                } else {
                    noCPU++
                }
            } else {
                noCPU++
            }

            locallyGroupped.set(index, grouppedEntry)
        })

        // Summarize and merge local (per-website) stats with global stats
        locallyGroupped.forEach((value, key) => {
            const grouppedEntry = groupped.get(key) || {time: [], size: [], cache: [], cpu: [], resourcesPerSite: []}

            const totalTime = math.sum(value.time)
            const totalSize = math.sum(value.size)
            const totalCPU = math.sum(value.cpu)

            grouppedEntry.time.push(totalTime)
            grouppedEntry.size.push(totalSize)
            // if crawl file didn't include have trace data, don't push a 0
            if (cpuPerformanceData) {
                grouppedEntry.cpu.push(totalCPU)
            }
            grouppedEntry.cache.push(...value.cache)
            grouppedEntry.resourcesPerSite.push(value.time.length)

            groupped.set(key, grouppedEntry)
        })
    })

    await Promise.all(promises)

    console.log(`Time info missing: ${Math.round(noTime/(noTime + hasTime) * 100)}% (${noTime} requests)`)
    console.log(`Size info missing: ${Math.round(noSize/(noSize + hasSize) * 100)}% (${noSize} requests)`)
    console.log(`CPU info missing: ${Math.round(noCPU/(noCPU + hasCPU) * 100)}% (${noCPU} requests)`)
    console.log(`Response headers missing: ${Math.round(noHeaders/(noHeaders + hasHeaders) * 100)}% (${noHeaders} requests)`)

    const outputFolder = path.join(dataDir, './output/')

    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder)
    }

    const outputFile = path.join(outputFolder, './grouped_data.json')
    console.log(`Writting data to ${outputFile}`)
    fs.writeFileSync(outputFile, JSON.stringify(Array.from(groupped), null, 2))
}

main()

/**
 * @typedef {object} LocalStats
 * @property {Array<number>} cache
 * @property {Array<number>} time
 * @property {Array<number>} size
 * @property {Array<number>} cpu
 */

/**
 * @typedef {object} GlobalStats
 * @property {Array<number>} cache
 * @property {Array<number>} time
 * @property {Array<number>} size
 * @property {Array<number>} cpu
 * @property {Array<number>} resourcesPerSite
 */

/**
  * @typedef {object} Request
  * @property {string} url
  * @property {number} time
  * @property {number} size
  * @property {Object<string, string>} responseHeaders
  */
