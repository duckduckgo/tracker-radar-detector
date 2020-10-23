const sharedData = require('./sharedData.js')

function getOwner (domain) {
    if (!domain) {
        return ''
    }
    
    if (sharedData.entityMap.get(domain)) {
        return sharedData.entityMap.get(domain)
    }

    const parts = domain.split('.')
    parts.shift()
    return getOwner(parts.join('.'))
}

module.exports = getOwner
