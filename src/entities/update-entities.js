/**
 * @fileoverview This script takes lists of domains and attempts to find their owners.
 */

const fs = require('fs')
const exec = require('child_process').exec
const request = require('request')
const parse = require('csv-parse/lib/sync')
const config = require('./../../config.json')
const trackerDir = `${config.trackerDataLoc}/domains/`
const whoisIgnoreList = require('./data/whoisIgnoreList.json')
const SSLIgnoreList = require('./data/SSLIgnoreList.json')
const domainMap = require(`${config.trackerDataLoc}/build-data/generated/domain_map.json`)
const entityMap = require(`${config.trackerDataLoc}/build-data/generated/entity_map.json`)
const shortNames = require('./shortNames.js')
const whoisRegexArray = whoisIgnoreList.map(regex => new RegExp(regex, 'gi'))
const SSLRegexArray = SSLIgnoreList.map(regex => new RegExp(regex, 'gi'))
const currentDate = new Date(Date.now()).toISOString()
const WHOIS_XML_TOKEN = ''// credentials

/**
 * Fetch x509 certificate data for domain by dropping to bash and using openSSL.
 */
const fetchSSLData = domain => {
    return new Promise(resolve => {
        // SSL requests time out for a variety of reasons, so set promise to resolve if no response in 5s
        setTimeout(() => {
            resolve('errored out')
        }, 2000)
        exec(`echo | openssl s_client -connect ${domain}:443 -servername ${domain} | openssl x509 -noout -text`, (err, stdout) => {
            // If error occurs, it's probably due to either improperly set up or nonexistent SSL certificate.
            if (err) {
                resolve('errored out')
            }
            resolve(stdout)
        })
    })
}

/**
 * Fetch Whois data for domain via whoisxmlapi.com, since standard unix whois is rate limited.
 */
const fetchWhoisData = domain => {
    return new Promise(resolve => {
        request(`https://www.whoisxmlapi.com/whoisserver/WhoisService?domainName=${domain}&outputFormat=JSON&apiKey=${WHOIS_XML_TOKEN}`, (error, response, body) => {
            if (error) {
                resolve('errored out')
            }
            const jsonResponse = JSON.parse(body)
            if (jsonResponse.ErrorMessage) {
                resolve('errored out')
            }
            resolve(jsonResponse)
        })
    })
}

/**
 * Extract desired data from x509 certificate while removing noise.
 */
const filterSSLData = response => {
    // We're looking for the company that the SSL cert was issued to, as well as the subject alternative names on the certificate.
    // Depending on the length of the certificate chain, there may be multiple owner fields. We want the last one, which is most likely
    // to be the name of the actual company.
    // TODO check whois data for alt subjects on cert, add to entity if data matches
    const sslNames = response.match(/O = .*,/g) || []
    // const sslAltNames = response.match(/DNS:.*/g) || []
    let sslCompany = sslNames[sslNames.length - 1]
    if (sslCompany) {
        // Here we want to remove the 'O = ' part of the name from the beginning of the string,
        // and any other fields from the end of the string that aren't part of the owner field.
        sslCompany = sslCompany.replace(/^O = /,'').replace(/, OU.*/,'').replace(/, CN.*/,'').replace(/, L = .*/,'').replace(/, ST = .*/,'')
        // Certs may contain businessCategory  or serialNumber within the owner field, which needs to be filtered out.
        sslCompany = sslCompany.replace(/, businessCategory = .*/,'').replace(/, serialNumber = .*/,'')
        // Remove trailing comma and any trailing spaces
        sslCompany = sslCompany.replace(/,$/,'').trim()
        // We want to knock out first and last quotes around company name, but not others that might be within name.
        if (sslCompany.match(/^"/g) && sslCompany.match(/"$/g)) {
            sslCompany = sslCompany.replace(/^"/g,'').replace(/"$/g,'')
        }
        // Replace utf-8 hex chars if present.
        if (sslCompany.match(/\\/g)) {
            // match \ not followed by "
            sslCompany = decodeURIComponent(sslCompany.replace(/\\(?!")/g,'%'))
        }
        // Filter out noisy data using array of regular expressions.
        for (const regex in SSLRegexArray) {
            if (sslCompany.match(SSLRegexArray[regex])) {
                sslCompany = ''
            }
        }
    }
    const sslInfo = {'Company': sslCompany, 'Date': currentDate}
    return sslInfo
}

/**
 * Extract desired data from whois response while removing noise.
 */
const filterWhoisData = response => {
    // TODO for .jp domains, organization and name fields seem to be switched.
    // TODO for .ly domains, registrant data is duplicated (see embed.ly)
    const data = response.WhoisRecord
    let registrantOrg = ''
    let adminOrg = ''
    let techOrg = ''
    // Registrant Organization data may appear in three different fields: registrant.organization, registrant.name, registryData.registrant.organization.
    if (data.registrant && data.registrant.organization) {
        registrantOrg = data.registrant.organization
    } else if (data.registrant && data.registrant.name) {
        registrantOrg = data.registrant.name
    } else if (data.registryData && data.registryData.registrant && data.registryData.registrant.organization) {
        registrantOrg = data.registryData.registrant.organization
    } else if (data.registryData && data.registryData.registrant && data.registryData.registrant.name) {
        registrantOrg = data.registryData.registrant.name
    }
    // Administrative Organization data may appear in two different fields: administrativeContact.organization, administrativeContact.name
    if (data.administrativeContact && data.administrativeContact.organization) {
        adminOrg = data.administrativeContact.organization
    } else if (data.administrativeContact && data.administrativeContact.name) {
        adminOrg = data.administrativeContact.name
    }
    // Technical Organization may appear in two different fields: technicalContact.organization, technicalContact.name
    if (data.technicalContact && data.technicalContact.organization) {
        techOrg = data.technicalContact.organization
    } else if (data.technicalContact && data.technicalContact.name) {
        techOrg = data.technicalContact.name
    }
    // filter out register number
    registrantOrg = registrantOrg.replace(/\nregister number:.*/g,'')
    adminOrg = adminOrg.replace(/\nregister number:.*/g,'')
    techOrg = techOrg.replace(/\nregister number:.*/g,'')
    // Store date whois data was pulled
    const whoisDate = data.audit.updatedDate
    const whoisInfo = {'Registrant Organization': registrantOrg.trim(), 'Tech Organization': techOrg.trim(), 'Admin Organization': adminOrg.trim(), 'Date': whoisDate}
    // Filter out noisy data using array of regular expresssions.
    for (const regex in whoisRegexArray) {
        if (whoisInfo['Registrant Organization'] && whoisInfo['Registrant Organization'].match(whoisRegexArray[regex])) {
            whoisInfo['Registrant Organization'] = ''
        }
        if (whoisInfo['Admin Organization'] && whoisInfo['Admin Organization'].match(whoisRegexArray[regex])) {
            whoisInfo['Admin Organization'] = ''
        }
        if (whoisInfo['Tech Organization'] && whoisInfo['Tech Organization'].match(whoisRegexArray[regex])) {
            whoisInfo['Tech Organization'] = ''
        }
    }
    return whoisInfo
}

/**
 * Fetch and filter data from different sources for a domain.
 */
async function fetchInfoForDomain(domain) {
    const domainObj = {}
    let sslInfo = await fetchSSLData(domain)
    if (sslInfo === 'errored out') {
        // sites often lack ssl certs for their root domain when they redirect to www, so
        // check root domain with www appended
        sslInfo = await fetchSSLData(`www.${domain}`)
    }
    // If no sslInfo returned, site either doesn't have SSL cert or it's improperly set up.
    // In this case, note failure and move on.
    if (!sslInfo) {
        domainObj.sslInfo = {'Company': '', 'Alt Names': [], 'Failed': true}
    } else {
        domainObj.sslInfo = filterSSLData(sslInfo)
    }
    // Now check whois data for domain
    const whoisInfo = await fetchWhoisData(domain)
    // If initial whois request fails, note failure and move on
    if (whoisInfo === 'errored out') {
        domainObj.whoisInfo = {'Registrant Organization': '', 'Tech Organization': '', 'Admin Organization': '', 'Date': currentDate, 'Failed': true}
    } else {
        domainObj.whoisInfo = filterWhoisData(whoisInfo)
    }
    return domainObj
}

/**
 * Pick single entity for domain, converge similar entities
 */
const chooseName = domainObj => {
    let entity = ''
    let existingEntity = ''
    // follow hierarchy: SSL Company -> Whois Registrant Org -> Whois Admin Org -> Whois Tech Org
    if (domainObj.sslInfo.Company || domainObj.whoisInfo['Admin Organization'] || domainObj.whoisInfo['Registrant Organization'] || domainObj.whoisInfo['Tech Organization']) {
        if (domainObj.sslInfo.Company) {
            entity = domainObj.sslInfo.Company
        } else if (domainObj.whoisInfo['Registrant Organization']) {
            entity = domainObj.whoisInfo['Registrant Organization']
        } else if (domainObj.whoisInfo['Admin Organization']) {
            entity = domainObj.whoisInfo['Admin Organization']
        } else if (domainObj.whoisInfo['Tech Organization']) {
            entity = domainObj.whoisInfo['Tech Organization']
        }
        if (!entity) {return}

        if (entityMap[entity]) {
            existingEntity = entity
        } else {
            // If entity not already in entity map, check if entity is in list of
            // aliases for another entity.
            for (const entry in entityMap) {
                if (entityMap[entry].aliases.includes(entity)) {
                    existingEntity = entry
                    break
                } else {
                    // check if slight variation of existing name exists. If it does, add variation
                    // to aliases array for existing entity
                    const normalizedEntity = entity.toLocaleLowerCase().replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '').replace(/limited$/g,'').replace(/ltd$/g,'').replace(/incorporated$/g,'').replace(/inc$/g,'').replace(/llc$/g,'').replace(/gmbh$/g,'').replace(/corporation$/g,'').replace(/corp$/g,'').trim()
                    const normalizedEntry = entry.toLocaleLowerCase().replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '').replace(/limited$/g,'').replace(/ltd$/g,'').replace(/incorporated$/g,'').replace(/inc$/g,'').replace(/llc$/g,'').replace(/gmbh$/g,'').replace(/corporation$/g,'').replace(/corp$/g,'').trim()
                    if (normalizedEntity === normalizedEntry) {
                        existingEntity = entry
                        break
                    }
                }
            }
        }

        return existingEntity
    }
}

async function checkTrackerFiles(directory) {
    const entityCSV = fs.readFileSync('./data/entityUpdates.csv')
    const checkedDomains = parse(entityCSV, {columns: true}).map(obj => obj.Domain)

    fs.readdir(directory, async (err, fileNames) => {
        if (err) {
            return
        }
        for (const i in fileNames) {
            const name = fileNames[i]
            const fileContent = await readFile(directory + name)
            const domainName = fileContent.domain
            if (checkedDomains.includes(domainName)) {continue}
            const existingName = fileContent.owner && fileContent.owner.name ? fileContent.owner.name : ''
            const domainInfo = await fetchInfoForDomain(fileContent.domain)
            let entityChanged = 0
            let bestName = chooseName(domainInfo)
            console.log(name)
            if (bestName) {
                const shortName = shortNames.getDisplayName(bestName)
                if (!existingName) {
                    entityChanged = 1
                } else if (existingName && existingName !== bestName) {
                    // check if name is an alias of existing entity. if it is,
                    // replace with entity name and no change for review
                    const existingDomainInfo = domainMap[domainName]
                    if (existingDomainInfo.aliases.indexOf(bestName) !== -1) {
                        bestName = existingDomainInfo.entityName
                    } else {
                        entityChanged = 1
                    }
                }

                // only add domains with entity changes
                if (entityChanged === 1) {
                    const row = `\n${domainName},${sanitizeCsvString(existingName)},${sanitizeCsvString(bestName)},${sanitizeCsvString(shortName)},0`
                    fs.appendFileSync('./data/entityUpdates.csv', row, 'utf8')
                }
            }
        }
    })
}

const sanitizeCsvString = name => {
    name = name.replace(/(\r\n|\n|\r|\s+|\t|&nbsp;)/gm, ' ')
    name = name.replace(/ +(?= )/g, '')
    // if name contains a comma or quote, wrap in quotes
    if (name.match(/"/g)) {
        name = name.replace(/"/g, '""')
    }
    if (name.match(/,|"/g)) {
        name = '"' + name + '"'
    }
    return name
}

/**
 * Check tracker files for updates and write changes to ./data/entityUpdates.csv for review
 */
async function update(directory) {
    if (!fs.existsSync('./data/entityUpdates.csv')) {
        const headers = 'domain,existingEntityName,newEntityName,displayName,acceptChange'
        fs.writeFileSync('./data/entityUpdates.csv', headers, 'utf8')
    } else {
        console.log('Found existing partial update, resuming where we left off')
    }
    checkTrackerFiles(directory)
}

const readFile = fileLocation => {
    return new Promise((resolve, reject) => {
        fs.readFile(fileLocation, 'utf-8', (err, content) => {
            if (err) {
                reject(err)
                return
            }

            const jsonContent = JSON.parse(content)
            resolve(jsonContent)
        })
    })
}

update(trackerDir)
