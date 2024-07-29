const assert = require('assert');
const URL = require('../src/trackers/helpers/url.js');
const sharedData = require('../src/trackers/helpers/sharedData')

const testCases = [
    {
        input: "media-rockstargames-com.akamaized.net",
        expectedOutput: {
            publicSuffix: "akamaized.net",
            domain: "media-rockstargames-com.akamaized.net",
            domainWithoutSuffix: "media-rockstargames-com",
            subdomain: "",
            isPrivate: true
        }
    },
    {
        input: "sub.media-rockstargames-com.akamaized.net",
        expectedOutput: {
            publicSuffix: "akamaized.net",
            domain: "media-rockstargames-com.akamaized.net",
            domainWithoutSuffix: "media-rockstargames-com",
            subdomain: "sub",
            isPrivate: true
        }
    },
    {
        input: "example.akamaihd.net",
        expectedOutput: {
            publicSuffix: "akamaihd.net",
            domain: "example.akamaihd.net",
            domainWithoutSuffix: "example",
            subdomain: "",
            isPrivate: true
        }
    },
    {
        input: "a.b.c.d.e.example.akamaihd.net",
        expectedOutput: {
            publicSuffix: "akamaihd.net",
            domain: "example.akamaihd.net",
            domainWithoutSuffix: "example",
            subdomain: "a.b.c.d.e",
            isPrivate: true
        }
    },
    {
        input: "example.com",
        expectedOutput: {
            publicSuffix: "com",
            domain: "example.com",
            domainWithoutSuffix: "example",
            subdomain: "",
            isPrivate: false
        }
    },
    {
        input: "sub.test.edgekey-staging.net",
        expectedOutput: {
            publicSuffix: "test.edgekey-staging.net",
            domain: "sub.test.edgekey-staging.net",
            domainWithoutSuffix: "sub",
            subdomain: "",
            isPrivate: true
        }
    },
    {
        input: "bucket.s3.us-west-2.amazonaws.com",
        expectedOutput: {
            publicSuffix: "s3.us-west-2.amazonaws.com",
            domain: "bucket.s3.us-west-2.amazonaws.com",
            domainWithoutSuffix: "bucket",
            subdomain: "",
            isPrivate: true
        }
    },
    {
        input: "example.ssl.global.fastly.net",
        expectedOutput: {
            publicSuffix: "ssl.global.fastly.net",
            domain: "example.ssl.global.fastly.net",
            domainWithoutSuffix: "example",
            subdomain: "",
            isPrivate: true
        }
    },
    {
        input: "example.x.incapdns.net",
        expectedOutput: {
            publicSuffix: "x.incapdns.net",
            domain: "example.x.incapdns.net",
            domainWithoutSuffix: "example",
            subdomain: "",
            isPrivate: true
        }
    },
    {
        input: "example.trafficmanager.net",
        expectedOutput: {
            publicSuffix: "trafficmanager.net",
            domain: "example.trafficmanager.net",
            domainWithoutSuffix: "example",
            subdomain: "",
            isPrivate: true
        }
    },
    {
        input: "akamaized.net",
        expectedOutput: {
            publicSuffix: "akamaized.net",
            domain: "akamaized.net",
            domainWithoutSuffix: "",
            subdomain: "",
            isPrivate: true
        }
    },
    {
        input: "example.com.akamaized.net",
        expectedOutput: {
            publicSuffix: "com.akamaized.net",
            domain: "example.com.akamaized.net",
            domainWithoutSuffix: "example",
            subdomain: "",
            isPrivate: true
        }
    }
];

describe('PSL domain parsing', () => {
    describe('parse domain with custom PSL', () => {
        testCases.forEach(({ input, expectedOutput }) => {
            it(`should correctly parse ${input}`, () => {
                if (!sharedData.config.pslExtras) {
                    it.skip('No custom PSL data provided')
                } else {
                    const result = new URL('https://' + input).domainInfo
                    assert.strictEqual(result.publicSuffix, expectedOutput.publicSuffix)
                    assert.strictEqual(result.domain, expectedOutput.domain)
                    assert.strictEqual(result.domainWithoutSuffix, expectedOutput.domainWithoutSuffix)
                    assert.strictEqual(result.subdomain, expectedOutput.subdomain)
                    assert.strictEqual(result.isPrivate, expectedOutput.isPrivate)
                }
            });
        });
    });
});
