const getFpRank = require('./../helpers/getFingerprintRank.js')

class Rule {
    constructor (newRuleData, totalSites) {
        this.rule = newRuleData.rule
        this.cookies = +newRuleData.cookies.toPrecision(3)
        this.fingerprinting = getFpRank(newRuleData.fpAvg + newRuleData.fpStd)
        this.foundOn = newRuleData.foundOn
        this.subdomains = newRuleData.subdomains
        this.apis = newRuleData.apis
        this.sites = newRuleData.sites
        this.prevalence = +(newRuleData.sites / totalSites).toPrecision(3)
        this.cnames = newRuleData.cnames
        this.type = newRuleData.type
    }
}

module.exports = Rule
