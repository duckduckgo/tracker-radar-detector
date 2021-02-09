const {getFingerprintRank} = require('./../helpers/fingerprints.js')
const sharedData = require('./../helpers/sharedData.js')

class Rule {
    constructor (newRuleData, totalSites) {
        this.rule = newRuleData.rule
        this.cookies = +newRuleData.cookies.toPrecision(3)
        this.fingerprinting = getFingerprintRank(newRuleData.fpAvg + newRuleData.fpStd)
        this.foundOn = newRuleData.foundOn
        this.subdomains = newRuleData.subdomains
        this.apis = newRuleData.apis
        this.sites = newRuleData.sites
        this.prevalence = +(newRuleData.sites / totalSites).toPrecision(3)
        this.cnames = newRuleData.cnames
        this.responseHashes = newRuleData.responseHashes
        this.type = newRuleData.type
        this.nameservers = newRuleData.nameservers
        this.firstPartyCookies = newRuleData.firstPartyCookies
        this.firstPartyCookiesSent = newRuleData.firstPartyCookiesSent

        if (sharedData.config.includeExampleSites) {
            this.exampleSites = newRuleData.exampleSites
        }
    }
}

module.exports = Rule
