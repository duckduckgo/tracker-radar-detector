#!/usr/bin/env node
const fs = require('fs')
const chalk = require('chalk')
const sharedData = require('./helpers/sharedData.js')
const Progress = require('progress')

const newDataStats = JSON.parse(fs.readFileSync(`${sharedData.config.trackerDataLoc}/crawlStats.json`, 'utf8'))
let requestsArray = []

let chunk = 0
while (fs.existsSync(`${sharedData.config.trackerDataLoc}/commonRequests-${chunk}.json`)) {
    const requests = JSON.parse(fs.readFileSync(`${sharedData.config.trackerDataLoc}/commonRequests-${chunk}.json`, 'utf8'))
    requestsArray = requestsArray.concat(requests)
    chunk++
}

// when reading crawl data from disk the region can be found in the crawl metadata
if (sharedData.config.crawlerDataLoc !== 'postgres') {
    const crawlMetadata = JSON.parse(fs.readFileSync(`${sharedData.config.crawlerDataLoc}/metadata.json`, 'utf8'))
    sharedData.config.regionCode = crawlMetadata.config.regionCode
}
const countryCode = sharedData.config.regionCode || 'US'
const crawledSiteTotal = newDataStats.sites
const summary = {trackers: 0, entities: []}

let requestPageMap = {}
try {
    requestPageMap = JSON.parse(fs.readFileSync(`${sharedData.config.pageMapLoc}/pagemap.json`, 'utf-8'))
} catch (e) {
    if (sharedData.config.includePages) {
        console.error('Could not load request page map: ', e)
    }
}

const Tracker = require(`./classes/tracker.js`)
const Rule = require(`./classes/rule.js`)
const trackers = {}
const trackerPageMap = {}

const bar = new Progress('Building trackers [:bar] :percent', {width: 40, total: requestsArray.length})

// Run through all the new trackers in our crawl data.
// Either create a new tracker entry or update an existing
requestsArray.forEach(newTrackerData => {
    const fileName = `${newTrackerData.host}.json`
    const rule = new Rule(newTrackerData, newDataStats.sites)

    // create a new tracker file
    if (!trackers[fileName]) {
        log(`${chalk.yellow('Create tracker:')} ${newTrackerData.rule} - ${newTrackerData.type} ${fileName}`)
        const tracker = new Tracker(newTrackerData, crawledSiteTotal)
        tracker.addRule(rule)
        tracker.addTypes(newTrackerData.type, newTrackerData.sites)
        tracker.addRegion(countryCode)

        // add this file so we know we now have an existing entry for this tracker
        trackers[fileName] = tracker
        summary.trackers++
        if (sharedData.config.includePages) {
            trackerPageMap[tracker.domain] = [...requestPageMap[rule.rule]]
        }
    } else {
        log(`${chalk.blue('update tracker')} ${fileName}`)
        trackers[fileName].addRule(rule)
        trackers[fileName].addTypes(newTrackerData.type, newTrackerData.sites)
        if (sharedData.config.includePages) {
            trackerPageMap[trackers[fileName].domain].push(...requestPageMap[rule.rule])
        }
    }

    if (!summary.entities.includes(trackers[fileName].owner.name)) {
        summary.entities.push(trackers[fileName].owner.name)
    }

    bar.tick()
})

if (!fs.existsSync(`${sharedData.config.trackerDataLoc}/domains/${countryCode}`)) {
    fs.mkdirSync(`${sharedData.config.trackerDataLoc}/domains/${countryCode}`)
}

for (const [fileName, tracker] of Object.entries(trackers)) {
    const filePath = `${sharedData.config.trackerDataLoc}/domains/${countryCode}/${fileName}`
    fs.writeFileSync(filePath, JSON.stringify(tracker, null, 4))
}

if (sharedData.config.includePages) {
    fs.writeFileSync(`${sharedData.config.pageMapLoc}/trackerpagemap.json`, JSON.stringify(trackerPageMap, null, 4))
}

console.log(`Found ${summary.trackers} ${chalk.green("trackers")}`)
console.log(`Found ${summary.entities.length} ${chalk.green("entities")}`)
console.log(chalk.green("Done"))

if (!fs.existsSync(`${sharedData.config.trackerDataLoc}/build-data/generated/${countryCode}`)) {
    fs.mkdirSync(`${sharedData.config.trackerDataLoc}/build-data/generated/${countryCode}`)
}

fs.writeFileSync(`${sharedData.config.trackerDataLoc}/build-data/generated/${countryCode}/releasestats.txt`, `${summary.trackers} domains\n${summary.entities.length} entities`)

function log (msg) {
    if (sharedData.config.verbose) {
        console.log(msg)
    }
}
