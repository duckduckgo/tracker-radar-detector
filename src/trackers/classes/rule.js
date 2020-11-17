const {getFingerprintRank} = require('./../helpers/fingerprints.js')
const sharedData = require('./../helpers/sharedData.js')
const ruleHelper = require('./../helpers/rule.js')

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

        if (sharedData.config.includeExampleSites) {
            this.exampleSites = ruleHelper.getExampleSites(newRuleData.pages, sharedData.config.includeExampleSites)
        }
    }
}

module.exports = Rule
