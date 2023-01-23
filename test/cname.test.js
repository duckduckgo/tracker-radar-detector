const assert = require('assert')
const {describe, it, before} = require('mocha')

const cnameHelper = require('../src/trackers/helpers/cname')
const URL = require('../src/trackers/helpers/url.js')


describe('CNAME helpers', () => {
    describe('builds CNAME record correctly', () => {
        const url = 'https://assets.targetimg1.com/ssx/ssx.mod.js'
        const request = {
            url,
            data: new URL(url)
        }
        const cname = 'target-opus.map.fastly.net'
        // based on site.js#218
        const origSubDomain = request.data.subdomain + "." + request.data.domain
        request.data = new URL(`http://${cname}`)
        request.wasCNAME = true
        request.originalSubdomain = origSubDomain

        const cnameRecord = cnameHelper.createCnameRecord(request)
        assert.deepStrictEqual(cnameRecord, {
            original: 'assets.targetimg1.com',
            resolved: 'target-opus.map.fastly.net'
        })
    })
})
