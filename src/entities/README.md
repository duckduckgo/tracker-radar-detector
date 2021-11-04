# Overview
The Entity List is the map of domains and their owners used by [Tracker Radar](https://github.com/duckduckgo/tracker-radar/).
It's used to identify tracking companies and distinguish between first and third party requests, and can be found 
[here](https://github.com/duckduckgo/tracker-radar/blob/main/build-data/generated/entity_map.json).

## Usage
There are a few ways to update entity data, all of which require you to clone the [Tracker Radar](https://github.com/duckduckgo/tracker-radar/) repository and update 
[config.json](https://github.com/duckduckgo/tracker-radar-detector/blob/main/config.json#L3) to reference its location.

### Manual update
Entity data may be manually updated in one of two ways:
1) To make minor changes, simply edit the [entity_map.json](https://github.com/duckduckgo/tracker-radar/blob/main/build-data/generated/entity_map.json)
file and run `npm run apply-entity-changes`.
2) To apply multiple changes at once, a JSON file may be passed via CLI: `npm run apply-entity-changes path/to/file`. This file must have the same structure
as `entity_map.json`.

### Automated update
Entity data may be automatically updated as well using WHOIS and SSL certificate data. There are three steps to this process:
1) `npm run update-entities` - runs through 3p domains seen in latest Tracker Radar crawl and logs any changes to their existing entity data to `data/entityUpdates.csv`.
2) Manually verify pending changes by looking at `data/entityUpdates.csv` and changing the `acceptChange` row value to `1` after confirming data is accurate
3) `npm run apply-entity-changes` - parses this csv file and applies the accepted changes to Tracker Radar data files
