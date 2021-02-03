const assert = require('assert')
const {describe, it} = require('mocha')

const {parseCookie,calculateCookieTtl,isFirstPartyCookie,isCookieValueInUrl} = require('../src/trackers/helpers/cookies')

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

describe('isFirstPartyCookie', () => {
    const firstPartyExamples = [
        [undefined, 'example.com', true],
        ['example.com', 'example.com', true],
        ['.example.com', 'example.com', true],
        ['www.example.com', 'example.com', true],
        ['.co.uk', 'example.co.uk', false],
        ['.github.com', 'hub.com', false],
    ]
    firstPartyExamples.forEach(([cookieDomain, siteDomain, expected]) => {
        it(`isFirstPartyCookie(${cookieDomain}, ${siteDomain}) === ${expected}`, () => {
            assert.strictEqual(isFirstPartyCookie(cookieDomain, siteDomain), expected)
        })
    })
})

describe('isCookieValueInUrl', () => {
    const mockCookie = parseCookie('foo=bar;path=/;max-age=3600')

    it('returns true if the cookie value is in the url path', () => {
        assert.strictEqual(isCookieValueInUrl(mockCookie, new URL('https://example.com/bar')), true)
        assert.strictEqual(isCookieValueInUrl(mockCookie, new URL('https://example.com/bar/something')), true)
        assert.strictEqual(isCookieValueInUrl(mockCookie, new URL('https://example.com/somebarthing')), true)
    })

    it('returns true if the cookie value is in the url query', () => {
        assert.strictEqual(isCookieValueInUrl(mockCookie, new URL('https://example.com/?test=bar')), true)
        assert.strictEqual(isCookieValueInUrl(mockCookie, new URL('https://example.com/?bar=foo')), true)
    })

    it('returns false if the cookie value is in the url hostname', () => {
        assert.strictEqual(isCookieValueInUrl(mockCookie, new URL('https://bar.example.com/?test')), false)
    })

    describe('_ga cookie special case', () => {
        const gaCookie = parseCookie('_ga=GA1.2.2073038129.1608010879; path=/; expires=Thu, 15 Dec 2022 05:41:27 GMT; domain=example.com;')

        it('returns true if the _ga cookie is in the url', () => {
            assert.strictEqual(isCookieValueInUrl(gaCookie, new URL('https://example.com/?ga=2073038129.1608010879')), true)
        })
    })
})
