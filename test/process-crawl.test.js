const assert = require('assert')
const {describe, it, before} = require('mocha')

const Site = require('../src/trackers/classes/site')
const crawl = require('../src/trackers/classes/crawl.js')
const sharedData = require('../src/trackers/helpers/sharedData')

const mockSiteData = require('./fixtures/example.com.json')

function assertObjectPartial(actual, expected) {
    Object.keys(expected).forEach(prop => {
        assert.deepStrictEqual(actual[prop], expected[prop], `${prop}: ${actual[prop]} should equal ${expected[prop]}`)
    })
}

describe('Process Crawl', () => {

    let site
    const expectedDomains = [
        "googletagmanager.com",
        "google-analytics.com",
        "tracker.com"
    ]
    
    before(async () => {
        // Mock owner of 3rd party domains
        sharedData.entityMap.set('google-analytics.com', 'Google LLC')
        sharedData.analyseScripts = [
            'google-analytics\\.com/analytics\\.js',
        ]
        site = new Site(mockSiteData)
        for (const request of mockSiteData.data.requests) {
            await site.processRequest(request)
            crawl.stats.requests++
        }
        await crawl.processSite(site)
        Object.values(crawl.commonRequests).forEach(req => req.finalize(2))
    })

    describe('site', () => {
        it('parses the host and etld+1', () => {
            assert.strictEqual(site.domain, 'example.com')
            assert.strictEqual(site.host, 'test.example.com')
            assert.strictEqual(site.subdomain, 'test')
        })

        it('extracts 3p domains', () => {
            assert.deepStrictEqual(Object.keys(site.uniqueDomains), expectedDomains)
        })

        it('extracts 3p domain initiators', () => {
            assert.deepStrictEqual(site.uniqueDomains['google-analytics.com'].initiators, {"googletagmanager.com": 8})
        })

        it('extracts 3p entities', () => {
            assert.deepStrictEqual(site.uniqueEntities, {
                "Google LLC": {
                    "tracking": true
                },
                undefined: {
                    "tracking": true
                }
            })
        })

        it('extracts document cookies', () => {
            assert.deepStrictEqual(site.thirdPartyJSCookies, [{
                domain: 'example.com',
                expires: 'Thu, 15 Dec 2022 05:41:27 GMT',
                name: '_ga',
                path: '/',
                source: 'https://www.google-analytics.com/analytics.js',
                value: 'GA1.2.2073038129.1608010879',
                ttl: 63113410,
            }])
        })
    })

    describe('crawl', () => {
        it('extracts domain prevalence', () => {
            assert.deepStrictEqual(crawl.domainPrevalence, {
                "google-analytics.com": 1,
                "googletagmanager.com": 1,
                "tracker.com": 1,
            })
        })

        it('extracts domain fingerprinting', () => {
            assert.deepStrictEqual(Object.keys(crawl.domainFingerprinting), expectedDomains)
        })

        it('extracts domain cookies', () => {
            assert.deepStrictEqual(crawl.domainCookies, {
                'google-analytics.com': 1,
                'tracker.com': 1,
            })
        })

        it('extracts domain initiators', () => {
            assert.deepStrictEqual(crawl.domainInitiators, {
                'google-analytics.com': {
                    'googletagmanager.com': 8
                },
                'googletagmanager.com': {
                    'first party': 1
                },
                'tracker.com': {
                    'first party': 1
                },
            })
        })

        it('extracts common requests', () => {
            // test some aspects of common request data
            assert.strictEqual(crawl.commonRequests['google-analytics.com/analytics.js - Script'].apis['Navigator.prototype.userAgent'], 1)
            assertObjectPartial(crawl.commonRequests['google-analytics.com/analytics.js - Script'], {
                cookies: 0.5,
                firstPartyCookies: {
                    "_ga": {
                        prevalence: 0.5,
                        length: 27,
                        uniqueness: 1,
                        ttl: 63113410,
                    }
                }
            })
    
            assertObjectPartial(crawl.commonRequests["tracker.com/collect - XHR"], {
                apis: {},
                cnames: [],
                cookies: 0.5, // this value is a proportion relative to the total number of sites
                fpAvg: 0,
                fpStd: 0,
                host: "tracker.com",
                prevalence: 0.5,
                responseHashes: [],
                rule: "tracker\\.com\\/collect",
                sites: 1,
                subdomains: ['dummy'],
                type: "XHR",
                firstPartyCookiesSent: {
                    "_ga": 0.5,
                }
            })
        })

        it('extracts data by site', () => {
            assertObjectPartial(crawl.dataBySite, {
                "example.com": {
                    "test.example.com": {
                        "fingerprinting": {
                            "google-analytics\\.com/analytics\\.js": {
                                "apis": [
                                    "Date.prototype.getTime",
                                    "Document.cookie getter",
                                    "Document.cookie setter",
                                    "Navigator.prototype.javaEnabled",
                                    "Navigator.prototype.language",
                                    "Navigator.prototype.plugins",
                                    "Navigator.prototype.userAgent",
                                    "Screen.prototype.colorDepth",
                                    "Screen.prototype.height",
                                    "Screen.prototype.width",
                                ],
                            },
                        },
                    },
                },
            })
        })

        it('extracts domain cloaks', () => {
            assert.deepStrictEqual(crawl.domainCloaks, {})
        })
    })

})
