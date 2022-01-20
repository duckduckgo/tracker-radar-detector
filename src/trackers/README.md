## Process

`process-crawl.js` reads in crawler data (defined in config.json) and generates a large overview file (commonRequests.json). This overview file groups 3rd party requests and collects information about what APIs were useed, cookies set, and other request level metrics.

`build-trackers.js` reads in commonRequests.json and reformats each 3rd party request into a tracker file.
 
 `tracking-params.js` reads in crawler data (defined in config.json) and generates a file (tracker-radar/build-data/tracking_parameters.json). This file contains data on parameters used in third party requests and cookies.
