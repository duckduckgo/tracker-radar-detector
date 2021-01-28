const assert = require('assert')
const {describe, it, before} = require('mocha')

const Tracker = require('../src/trackers/classes/tracker')
const Rule = require('../src/trackers/classes/rule')
const sharedData = require('../src/trackers/helpers/sharedData')

const commonRequestData1 = {
    apis: {},
    cnames: [],
    cookies: 1,
    fpAvg: 0,
    fpStd: 0,
    host: "tracker.com",
    prevalence: 1,
    responseHashes: [],
    rule: "tracker\\.com\\/collect",
    sites: 2,
    subdomains: new Set(['dummy']),
    type: "XHR",
    firstPartyCookies: {
        "_uid": {
            prevalence: 0.8,
            length: 14,
            uniqueness: 1,
            expiry: 2628000,
        }
    },
    firstPartyCookiesSent: {
        "_ga": 0.5,
    }
}
const commonRequestData2 = {
    apis: {},
    cnames: [],
    cookies: 0.5,
    fpAvg: 0,
    fpStd: 0,
    host: "tracker.com",
    prevalence: 0.5,
    responseHashes: [],
    rule: "tracker\\.com\\/collect",
    sites: 1,
    subdomains: new Set(['dummy']),
    type: "Other",
}

const crawlSiteCount = 2

describe('Tracker', () => {

    let tracker
    let rule

    before(() => {
        // Disable include example sites
        sharedData.config.includeExampleSites = false
        // TODO - this domain summary data should be explicitly provided rather than loaded by sharedData.
        sharedData.domains['tracker.com'] = {
            prevalence: 0.01,
        }
        rule = new Rule(commonRequestData1, crawlSiteCount)
        tracker = new Tracker(commonRequestData1, crawlSiteCount)

        tracker.addRule(rule)
        tracker.addTypes(commonRequestData1.type, commonRequestData1.sites)
        tracker.addRule(new Rule(commonRequestData2, crawlSiteCount))
        tracker.addTypes(commonRequestData2.type, commonRequestData2.sites)
    })

    it('has a domain', () => {
        assert.strictEqual(tracker.domain, 'tracker.com')
    })

    it('has cookies', () => {
        assert.strictEqual(tracker.cookies, 0) // TODO: should this consider cookiesOn too?
    })

    it('has prevalence from sharedData', () => {
        assert.strictEqual(tracker.prevalence, 0.01)
    })

    it('has resources for each request path + type', () => {
        assert.strictEqual(tracker.resources.length, 2)
    })

    it('resource has prevalence and sites', () => {
        const resource = tracker.resources[0]
        assert.strictEqual(resource.type, 'XHR')
        assert.strictEqual(resource.prevalence, 1)
        assert.strictEqual(resource.sites, 2)
    })

    it('resource has firstPartyCookies stats', () => {
        const resource = tracker.resources[0]
        assert.deepStrictEqual(resource.firstPartyCookies, {
            "_uid": {
                prevalence: 0.8,
                length: 14,
                uniqueness: 1,
                expiry: 2628000,
            }
        })
    })

    it('resource has firstPartyCookiesSent stats', () => {
        const resource = tracker.resources[0]
        assert.deepStrictEqual(resource.firstPartyCookiesSent, {
            "_ga": 0.5
        })
    })
})
