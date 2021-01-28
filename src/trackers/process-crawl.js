#!/usr/bin/env node
const chalk = require('chalk')
const Progress = require('progress')

const sharedData = require('./helpers/sharedData.js')
const crawl = require('./classes/crawl.js')
const Site = require('./classes/site.js')

const {JSONFileDataReader, PostgresDataReader} = require('./helpers/readers')

console.log(`Reading crawl from: ${sharedData.config.crawlerDataLoc}`)
let bar

// Process a single site crawler file. This will look through each request in the file
// and update the corresponding entry in the global commonRequests object with new data
// it finds for each request. subdomains, cookies, fingerprint apis used, etc...
// @param {string, crawler file name}
async function processSite(siteData) {
    // check that the crawl for this site finished and has data to process
    if (!siteData.initialUrl || !(siteData.data.requests && siteData.data.requests.length)) {
        crawl.stats.requestsSkipped += 1
        bar.tick()
        return
    }

    const site = new Site(siteData)

    for (const request of siteData.data.requests) {
        await site.processRequest(request)
        crawl.stats.requests++
    }

    // update crawl level domain prevalence, entity prevalence, and fingerprinting
    crawl.processSite(site)
    crawl.stats.sites++
    bar.tick()
}

async function processCrawl() {
    const reader = sharedData.config.crawlerDataLoc === 'postgres'
        ? new PostgresDataReader(sharedData.config.crawlId, sharedData.config.regionCode)
        : new JSONFileDataReader(sharedData.config.crawlerDataLoc)
    console.time("runtime")
    try {
        bar = new Progress('Process crawl [:bar] :percent', {width: 40, total: await reader.length()})

        let sites = []
        for await (const siteData of reader.iterator()) {
            if (sites.length >= sharedData.config.parallelism) {
                // wait for batch to finish before reading more site data
                await Promise.allSettled(sites)
                sites = []
            }
            sites.push(processSite(siteData))
        }
        await Promise.allSettled(sites)
        crawl.finalizeRequests()
        crawl.writeSummaries()
        console.log(`${chalk.blue(crawl.stats.sites)} sites processed\n${chalk.blue(crawl.stats.requests)} requests processed\n${chalk.blue(crawl.stats.requestsSkipped)} requests skipped`)
    } finally {
        console.timeEnd("runtime")
        reader.close()
    }
}

/// process the sites and write summary files
processCrawl()
