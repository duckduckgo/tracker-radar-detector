const config = require('./../../config.json')
const entityMap = require(`${config.trackerDataLoc}/build-data/generated/entity_map.json`)
const corpList = require('./data/corpWords.json')
// sort corp words by descending length, so longest substring match
// takes place first, eg match on gmbh before mbh
const sortedCorpList = corpList.sort((a,b) => {return b.length - a.length})

function getDisplayName(name) {
    let shortName = name
    // check to see if name is all caps and a non-caps equivalent alias exists
    if (name.toLocaleUpperCase() === name && (entityMap[name] && entityMap[name]['aliases'].length > 1)) {
        let aliases = entityMap[name]['aliases']
        for (const index in aliases) {
            let aliasNoPunct = aliases[index].toLocaleLowerCase().replace(/\+|\/|\&|\.|-|\+| /g, '')
            let nameNoPunct = name.toLocaleLowerCase().replace(/\+|\/|\&|\.|-|\+| /g, '')
            if (name !== aliases[index] && nameNoPunct === aliasNoPunct) {
                shortName = aliases[index]
                break
            }
        }
    }
    
    // strip off corp prefixes and suffixes
    shortName = removeCorpNames(shortName)

    // attempt second iteration of removing corp name. we do this to
    // catch names like amazon technologies inc
    if (shortName !== name) {
        shortName = removeCorpNames(shortName)
    }

    return shortName
}

function removeCorpNames(name) {
    let uname = name.replace(/\+|\/|\&|\.|-|\+| /g, '')
    let shortName = name
    for (const index in sortedCorpList) {
        let suffix = new RegExp(sortedCorpList[index] + '$', 'i')
        let prefix = new RegExp('^' + sortedCorpList[index], 'i')
        if (uname.match(suffix)) {
            let matchingSuffix = uname.match(suffix)[0]
            // match on suffixes that use spaces or other chars between letters
            // max seems to be 4 chars: m.b.H. & Co KG
            let matchingSpacedSuffix = matchingSuffix.split('').join('\\W{0,4}')
            // add non-word char to regex so inc doesn't match Zinc
            let spacedRegex = new RegExp('\\W' + matchingSpacedSuffix + '$', 'i')
            // remove trailing punctuation, in order to check for match
            let matchName = name.replace(/(\.|,)$/, '')

            if (matchName.match(spacedRegex)) {
                shortName = matchName.replace(spacedRegex, '')
                break
            }
        } else if (uname.match(prefix)) {
            let matchingPrefix = uname.match(prefix)[0]
            let matchingSpacedPrefix = matchingPrefix.split('').join('\\W{0,1}')
            let spacedRegex = new RegExp('^' + matchingSpacedPrefix + '\\W{0,1}\\s', 'i')
            let matchName = name.replace(/^\./, '')

            if (name.match(spacedRegex)) {
                shortName = name.replace(spacedRegex, '')
                break
            }
        }
    }

    // If name includes DBA, use second part of name
    if (shortName === name && name.match(/dba /gi)) {
        let matchingDba = name.match(/dba /gi)[0]
        shortName = name.split(matchingDba)[1].replace(/\)$/, '')
    }

    // remove trailing spaces periods and commas. replace multiple spaces with single space
    shortName = shortName.trim().replace(/(\.|,)$/g,'').trim().replace(/ {2,}/g, ' ')

    // remove quotes and parentheses when at start and end
    if (shortName.match(/^\"/) && shortName.match(/\"$/)) {
        shortName = shortName.replace(/^\"/, '').replace(/\"$/, '')
    } else if (shortName.match(/^\(/) && shortName.match(/\)$/)) {
        shortName = shortName.replace(/^\(/, '').replace(/\)$/, '')
    }

    // avoid instances of single character display names
    if (shortName.length < 2) {
        shortName = name
    }

    return shortName
}

module.exports = {
    getDisplayName: getDisplayName
}
