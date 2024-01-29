const assert = require('assert')
const {describe, it, before} = require('mocha')
const { getCategories } = require('../src/trackers/helpers/getCategory')

describe('getCategories', () => {
    it('generates a domain/category map', () => {
        const domainToCategpry = getCategories('test/fixtures/categorized_trackers.csv')
        assert.deepStrictEqual(domainToCategpry, {
            'ads.com': {
                'First Category': 1,
                'Advertising': 1,
            },
            'example.com': {
                'First Category': 0,
                'Advertising': 1,
            }
        })
    })
})


