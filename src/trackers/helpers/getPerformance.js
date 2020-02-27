const fs = require('fs')

function getPerformance (domain, perfDirPath) {
    let performance
    const filePath = `${perfDirPath}/${domain}.json`
    
    if (fs.existsSync(filePath)) {
        performance = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } else{
        return
    }

    const metrics = {
        time: performance.requestTimeScore || 0,
        size: performance.requestSizeScore || 0,
        cpu: performance.cpuTimeScore || 0,
        cache: performance.cacheTTLScore || 0
    }

    return metrics
}

module.exports = {
    getPerformance
}
