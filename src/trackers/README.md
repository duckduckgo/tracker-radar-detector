## Process

`process_crawl.js` reads in crawler data (defined in config.json) and generates a large overview file (commonRequests.json). This overview file groups 3rd party requests and collects information about what APIs were useed, cookies set, and other request level metrics.

`build_trackers.js` reads in commonRequests.json and reformats each 3rd party request into a tracker file.
