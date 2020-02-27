# EntityList
Automatically identify site owners using various signals.

## Usage
There are three steps to this process
1) `update-entities.js` - runs through 3p domains seen in crawl and logs any changes to their existing entity data to `data/entityUpdates.csv` for verification
2) Manually verify pending changes by looking at `data/entityUpdates.csv` and changing the `acceptChange` row value to `1` after confirming data is accurate
3) `apply-entity-changes.js` - parses this csv file and applies the accepted changes to data files
