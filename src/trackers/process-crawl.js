#!/usr/bin/env node
const chalk = require('chalk')
const fs = require('fs')
const Progress = require('progress')

const sharedData = require('./helpers/sharedData.js')
const crawl = require('./classes/crawl.js')
const Site = require('./classes/site.js')
const resolveCname = require('./helpers/cname.js')

console.log(`Reading crawl from: ${sharedData.config.crawlerDataLoc}`)

// get site file list
let siteFileList = fs.readdirSync(sharedData.config.crawlerDataLoc)

const bar = new Progress('Process crawl [:bar] :percent', {width: 40, total: siteFileList.length})
const parallellism = 100

// Process a single site crawler file. This will look through each request in the file
// and update the corresponding entry in the global commonRequests object with new data
// it finds for each request. subdomains, cookies, fingerprint apis used, etc...
// @param {string, crawler file name}
async function processSite(siteName) {
    const siteData = JSON.parse(fs.readFileSync(`${sharedData.config.crawlerDataLoc}/${siteName}`, 'utf8'))

    // check that the crawl for this site finished and has data to process
    if (!siteData.initialUrl || !(siteData.data.requests && siteData.data.requests.length)) {
        crawl.stats.requestsSkipped += 1
        bar.tick()
        return
    }

    const site = new Site(siteData)

    for (let request of siteData.data.requests) {
        await site.processRequest(request)
        crawl.stats.requests++
    }

    // update crawl level domain prevalence, entity prevalence, and fingerprinting
    crawl.processSite(site)
    crawl.stats.sites++
    bar.tick()
}

async function processCrawl(fileList) {
    console.time("runtime")
    
    for (let i=0; i < fileList.length; i += sharedData.config.parallelism) {
        let sites = []
        for (let site of fileList.slice(i, i + sharedData.config.parallelism)) {
            sites.push(processSite(site))
        }
        await Promise.allSettled(sites)
    }
    
    crawl.finalizeRequests()
    crawl.writeSummaries()
    console.log(`${chalk.blue(crawl.stats.sites)} sites processed\n${chalk.blue(crawl.stats.requests)} requests processed\n${chalk.blue(crawl.stats.requestsSkipped)} requests skipped`)
    console.timeEnd("runtime")
}

/// process the sites and write summary files

processCrawl(siteFileList)

