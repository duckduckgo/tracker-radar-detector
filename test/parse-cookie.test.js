const assert = require('assert')
const {describe, it} = require('mocha')

const {parseCookie,calculateCookieTtl} = require('../src/trackers/helpers/cookies')

const validCookies = [
    ['csm-hit=tb:s-ZP1GK7T6BAHZ943S3WS9|1607976278934&t:1607976279951&adb:adblk_no;expires=Mon, 29 Nov 2021 20:04:39 GMT;path=/', {
        name: 'csm-hit',
        value: 'tb:s-ZP1GK7T6BAHZ943S3WS9|1607976278934&t:1607976279951&adb:adblk_no',
        path: '/',
        expires: 'Mon, 29 Nov 2021 20:04:39 GMT'
    }, 25935235],
    ['ajs_anonymous_id=%227ad765cd-b323-44d6-9a97-fedf36d907ab%22; path=/; domain=.cnn.com; expires=Wed, 15 Dec 2021 04:30:27 GMT; SameSite=Lax', {
        domain: '.cnn.com',
        expires: 'Wed, 15 Dec 2021 04:30:27 GMT',
        name: 'ajs_anonymous_id',
        path: '/',
        samesite: 'Lax',
        value: '%227ad765cd-b323-44d6-9a97-fedf36d907ab%22'
    }, 27261583],
    ['foo=bar;path=/;max-age=3600', {
        name: 'foo',
        value: 'bar',
        path: '/',
        'max-age': '3600',
    }, 3600],
    ['foo=bar;path=/', {
        name: 'foo',
        value: 'bar',
        path: '/',
    }, NaN]
]

describe('parseCookie', () => {
    validCookies.forEach(([cookieString, expected]) => {
        it(`Parses ${cookieString} correctly`, () => {
            assert.deepStrictEqual(parseCookie(cookieString), expected)
        })
    })
})

describe('calculateCookieTtl', () => {
    const startTs = new Date('2021-02-02T15:50:43.604Z').getTime()
    validCookies.forEach(([cookieString, cookie, ttl]) => {
        it(`Determines TTL correctly for ${cookieString}`, () => {
            assert.strictEqual(calculateCookieTtl(cookie, startTs), ttl)
        })
    })
})
