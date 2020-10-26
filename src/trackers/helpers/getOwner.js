const sharedData = require('./sharedData.js')

function getOwner (domain) {
    if (!domain) {
        return
    }
    
    const owner = sharedData.entityMap.get(domain)

    if (owner) {
        return owner
    }

    const parts = domain.split('.')
    parts.shift()
    return getOwner(parts.join('.'))
}

module.exports = getOwner
