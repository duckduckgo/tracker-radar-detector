#!/usr/bin/env node
/**
 * @file This script, based on the grouped TLD performance data, calculates per-TLD stats (max, median, mean),
 * and assigns score for each property (based on normalized global values).
 */

const fs = require('fs')
const path = require('path')
const math = require('d3-array')
const config = require('./../../config.json')

const groupedDataFile = path.join(config.performanceDataLoc, './output/grouped_data.json')
console.log(`Processing grouped data from: ${groupedDataFile}`)

const groupedDataRaw = fs.readFileSync(groupedDataFile, 'utf-8')

// minimum number of samples required to calculate stats and assign score
const MIN_SAMPLES = 6

/**
 * @type {Map<string, import('./group_data').GlobalStats>}
 */
let groupedData = null
try {
    groupedData = new Map(JSON.parse(groupedDataRaw))
} catch (e) {
    throw new Error(`Grouped data can't be loaded: ${e.message}`)
}

/**
 * @type {{time: Array<number>, size: Array<number>, cache: Array<number>, cpu: Array<number>}}
 */
const all = {
    time: [],
    size: [],
    cache: [],
    cpu: []
}

/**
 * @type {Object<string, DetailedStats>}
 */
const stats = {}

groupedData.forEach((entry, name) => {
    const avgTime = math.mean(entry.time)
    const avgSize = math.mean(entry.size)
    const avgCache = math.mean(entry.cache)
    const avgCPU = math.mean(entry.cpu)

    if (entry.time.length >= MIN_SAMPLES) {
        all.time.push(avgTime)
    }

    if (entry.size.length >= MIN_SAMPLES) {
        all.size.push(avgSize)
    }

    if (entry.cache.length >= MIN_SAMPLES) {
        all.cache.push(avgCache)
    }

    if (entry.cpu.length >= MIN_SAMPLES) {
        all.cpu.push(avgCPU)
    }

    stats[name] = {
        time: {
            max: math.max(entry.time),
            median: math.median(entry.time),
            avg: avgTime,
            samples: entry.time.length
        },
        size: {
            max: math.max(entry.size),
            median: math.median(entry.size),
            avg: avgSize,
            samples: entry.size.length
        },
        cache: {
            max: math.max(entry.cache),
            median: math.median(entry.cache),
            avg: avgCache,
            samples: entry.cache.length
        },
        cpu: {
            max: math.max(entry.cpu),
            median: math.median(entry.cpu),
            avg: math.mean(entry.cpu),
            samples: entry.cpu.length
        },
        resourcesPerSite: {
            max: math.max(entry.resourcesPerSite),
            median: math.median(entry.resourcesPerSite),
            avg: math.mean(entry.resourcesPerSite),
            samples: entry.resourcesPerSite.length
        }
    }
})

console.log('Time entries', all.time.length)
console.log('Size entries', all.size.length)
console.log('CPU time entries', all.cpu.length)

console.log('\n')

console.log('Smallest avg time', math.min(all.time))
console.log('Biggest avg time', math.max(all.time))

console.log('Smallest avg size', math.min(all.size))
console.log('Biggest avg size', math.max(all.size))

console.log('Smallest avg CPU time', math.min(all.cpu))
console.log('Biggest avg CPU time', math.max(all.cpu))

console.log('\n')

const avgTime = math.mean(all.time)
const avgSize = math.mean(all.size)
const avgCPU = math.mean(all.cpu)
console.log('Avg avg time', avgTime)
console.log('Avg avg size', avgSize)
console.log('Avg avg CPU time', avgCPU)

const sdTime = math.deviation(all.time)
const sdSize = math.deviation(all.size)
const sdCPU = math.deviation(all.cpu)
console.log('SD avg time', sdTime)
console.log('SD avg size', sdSize)
console.log('SD avg CPU time', sdCPU)

console.log('\n')

const timeCutoff = avgTime + (2 * sdTime)
const sizeCutoff = avgSize + (2 * sdSize)
const cpuCutoff = avgCPU + (2 * sdCPU)

console.log('Time cutoff', timeCutoff)
console.log('Size cutoff', sizeCutoff)
console.log('CPU time cutoff', cpuCutoff)

const domainsAboveTimeCutoff = all.time.filter(t => t > timeCutoff).length
const domainsAboveSizeCutoff = all.size.filter(s => s > sizeCutoff).length
const domainsAboveCPUCutoff = all.cpu.filter(t => t > cpuCutoff).length

console.log('Domains above time cutoff', domainsAboveTimeCutoff)
console.log('Domains above size cutoff', domainsAboveSizeCutoff)
console.log('Domains above CPU time cutoff', domainsAboveCPUCutoff)

console.log('\n')

const daySec = 60 * 60 * 24
const weekSec = daySec * 7

console.log('Domains with avg cache TTL under 1d', all.cache.filter(c => c < daySec).length)
console.log('Domains with avg cache TTL under 7d', all.cache.filter(c => c < weekSec).length)

console.log('\n')

const minTimeScore = 1
const maxTimeScore = 3
const minSizeScore = 1
const maxSizeScore = 3
const minCPUScore = 1
const maxCPUScore = 3

/**
 * @param {1|2|3} outputMin 
 * @param {1|2|3} outputMax 
 * @param {number} inputMin 
 * @param {number} inputMax 
 * @param {number} inputValue 
 * 
 * @returns {1|2|3}
 */
function normalizeScore (outputMin, outputMax, inputMin, inputMax, inputValue) {
    const score = Math.round(((outputMax - outputMin) * (inputValue - inputMin) / (inputMax - inputMin)) + outputMin)

    if (score > outputMax) {
        return outputMax
    }

    if (score < outputMin) {
        return outputMin
    }

    // @ts-ignore
    return score
}

Object.keys(stats).forEach(key => {
    if (stats[key].time.samples >= MIN_SAMPLES) {
        stats[key].requestTimeScore = normalizeScore(minTimeScore, maxTimeScore, 0, timeCutoff, stats[key].time.avg)
    }

    if (stats[key].size.samples >= MIN_SAMPLES) {
        stats[key].requestSizeScore = normalizeScore(minSizeScore, maxSizeScore, 0, sizeCutoff, stats[key].size.avg)
    }

    if (stats[key].cpu.samples >= MIN_SAMPLES) {
        stats[key].cpuTimeScore = normalizeScore(minCPUScore, maxCPUScore, 0, cpuCutoff, stats[key].cpu.avg)
    }

    if (stats[key].cache.samples >= MIN_SAMPLES) {
        stats[key].cacheTTLScore = stats[key].cache.avg < weekSec ? 3 : 1
    }
})

console.log('Request time (seconds):\n')
console.log('✅ Green:', 0, '-', (0.25 * timeCutoff).toFixed(2))
console.log('⚠️ Yellow:', (0.25 * timeCutoff).toFixed(2), '-', (0.75 * timeCutoff).toFixed(2))
console.log('🚨 Red:', (0.75 * timeCutoff).toFixed(2), '-', '∞')
console.log('\nRequest size (bytes):\n')
console.log('✅ Green:', 0, '-', (0.25 * sizeCutoff).toFixed(2))
console.log('⚠️ Yellow:', (0.25 * sizeCutoff).toFixed(2), '-', (0.75 * sizeCutoff).toFixed(2))
console.log('🚨 Red:', (0.75 * sizeCutoff).toFixed(2), '-', '∞')
console.log('\nCPU time (ms):\n')
console.log('✅ Green:', 0, '-', (0.25 * cpuCutoff).toFixed(2))
console.log('⚠️ Yellow:', (0.25 * cpuCutoff).toFixed(2), '-', (0.75 * cpuCutoff).toFixed(2))
console.log('🚨 Red:', (0.75 * cpuCutoff).toFixed(2), '-', '∞')

console.log('\n')

const timeGreen = Object.keys(stats).filter(key => stats[key].requestTimeScore === 1).length
const timeYellow = Object.keys(stats).filter(key => stats[key].requestTimeScore === 2).length
const timeRed = Object.keys(stats).filter(key => stats[key].requestTimeScore === 3).length

console.log('Time: ', timeGreen, 'green', timeYellow, 'yellow', timeRed, 'red')

const sizeGreen = Object.keys(stats).filter(key => stats[key].requestSizeScore === 1).length
const sizeYellow = Object.keys(stats).filter(key => stats[key].requestSizeScore === 2).length
const sizeRed = Object.keys(stats).filter(key => stats[key].requestSizeScore === 3).length

console.log('Size: ', sizeGreen, 'green', sizeYellow, 'yellow', sizeRed, 'red')

const cacheGreen = Object.keys(stats).filter(key => stats[key].cacheTTLScore === 1).length
const cacheYellow = Object.keys(stats).filter(key => stats[key].cacheTTLScore === 2).length
const cacheRed = Object.keys(stats).filter(key => stats[key].cacheTTLScore === 3).length

console.log('Cache: ', cacheGreen, 'green', cacheYellow, 'yellow', cacheRed, 'red')

const cpuGreen = Object.keys(stats).filter(key => stats[key].cpuTimeScore === 1).length
const cpuYellow = Object.keys(stats).filter(key => stats[key].cpuTimeScore === 2).length
const cpuRed = Object.keys(stats).filter(key => stats[key].cpuTimeScore === 3).length

console.log('CPU time: ', cpuGreen, 'green', cpuYellow, 'yellow', cpuRed, 'red')

const outputFolder = path.join(config.performanceDataLoc, './output/')

if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder)
}

console.log(`\nWriting output files to ${outputFolder}`)

fs.writeFileSync(path.join(outputFolder, './stats.json'), JSON.stringify(stats, null, 2))

Object.keys(stats).forEach(key => {
    stats[key].url = key
    fs.writeFileSync(path.join(outputFolder, `./${key}.json`), JSON.stringify(stats[key], null, 2))
})

console.log('Done.')

/**
 * @typedef {object} DetailedStats
 * @property {string=} url
 * @property {PropertyStats} time
 * @property {PropertyStats} size
 * @property {PropertyStats} cache
 * @property {PropertyStats} cpu
 * @property {PropertyStats} resourcesPerSite
 * @property {1|2|3=} cpuTimeScore
 * @property {1|2|3=} cacheTTLScore
 * @property {1|2|3=} requestSizeScore
 * @property {1|2|3=} requestTimeScore
 */

/**
 * @typedef {object} PropertyStats
 * @property {number} max
 * @property {number} avg
 * @property {number} median
 * @property {number} samples
 */
