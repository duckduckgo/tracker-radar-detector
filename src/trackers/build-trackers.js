#!/usr/bin/env node
const fs = require('fs')
const chalk = require('chalk')
const sharedData = require('./helpers/sharedData.js')
const Progress = require('progress')
const glob = require('glob')
const newData = {requests:{}}

glob(`${sharedData.config.trackerDataLoc}/commonRequests*.json`, (err, files) => {
    if (err) {
        console.log(err)
    } else {
        files.forEach((file) => {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'))
            
            // each file has the same stats, only need it once
            if (!newData.stats) newData.stats = data.stats

            // combine requests lists from each file. Requests are all unique so no replacement happens
            newData.requests = Object.assign(newData.requests, data.requests)
        })
    }

    run()
})

function run () {

const crawlMetadata = JSON.parse(fs.readFileSync(`${sharedData.config.crawlerDataLoc}/metadata.json`, 'utf8'))
const countryCode = crawlMetadata.config.regionCode || 'US'
const crawledSiteTotal = newData.stats.sites
const summary = {trackers: 0, entities: []}

const Tracker = require(`./classes/tracker.js`)
const Rule = require(`./classes/rule.js`)
const trackers = {}

const bar = new Progress('Building trackers [:bar] :percent', {width: 40, total: Object.keys(newData.requests).length})

// Run through all the new trackers in our crawl data. 
// Either create a new tracker entry or update an existing
for (const key in newData.requests) {
    const newTrackerData = newData.requests[key]
    const fileName = `${newTrackerData.host}.json`
    const rule = new Rule(newTrackerData, newData.stats.sites)

    if (!(rule.cookies || rule.fingerprinting)) {
        bar.tick()
        continue
    }

    // create a new tracker file
    if (!trackers[fileName]) {
        log(`${chalk.yellow('Create tracker:')} ${key} ${fileName}`)
        const tracker = new Tracker(newTrackerData, crawledSiteTotal)
        tracker.addRule(rule)
        tracker.addTypes(newTrackerData.type, newTrackerData.sites)
        tracker.addRegion(countryCode)

        // add this file so we know we now have an existing entry for this tracker
        trackers[fileName] = tracker
        summary.trackers++
    } else {
        log(`${chalk.blue('update tracker')} ${fileName}`)
        trackers[fileName].addRule(rule)
        trackers[fileName].addTypes(newTrackerData.type, newTrackerData.sites)
    }
        
    if(!summary.entities.includes(trackers[fileName].owner.name)) {
        summary.entities.push(trackers[fileName].owner.name)
    }

    bar.tick()
}

if (!fs.existsSync(`${sharedData.config.trackerDataLoc}/domains/${countryCode}`)) {
    fs.mkdirSync(`${sharedData.config.trackerDataLoc}/domains/${countryCode}`)
}

for (const [fileName, tracker] of Object.entries(trackers)) {
    const filePath = `${sharedData.config.trackerDataLoc}/domains/${countryCode}/${fileName}`
    fs.writeFileSync(filePath, JSON.stringify(tracker, null, 4))
}

console.log(`Found ${summary.trackers} ${chalk.green("trackers")}`)
console.log(`Found ${summary.entities.length} ${chalk.green("entities")}`)
console.log(chalk.green("Done"))

if (!fs.existsSync(`${sharedData.config.trackerDataLoc}/build-data/generated/${countryCode}`)) {
    fs.mkdirSync(`${sharedData.config.trackerDataLoc}/build-data/generated/${countryCode}`)
}

fs.writeFileSync(`${sharedData.config.trackerDataLoc}/build-data/generated/${countryCode}/releasestats.txt`, `${summary.trackers} domains\n${summary.entities.length} entities`)
}

function log (msg) {
    if (sharedData.config.verbose) {
        console.log(msg)
    }
}
