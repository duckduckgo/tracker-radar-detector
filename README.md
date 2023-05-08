# DuckDuckGo Tracker Radar Detector

This is the code used to build a [Tracker Radar](https://github.com/duckduckgo/tracker-radar) data set using crawl data from the [Tracker Radar Collector](https://github.com/duckduckgo/tracker-radar-collector).

## Getting Started

To generate a Tracker Radar data set follow these steps:

1. Clone the [Tracker Radar](https://github.com/duckduckgo/tracker-radar) data repo

2. Generate 3rd party request data using the [Tracker Radar Collector](https://github.com/duckduckgo/tracker-radar-collector)

3. Update the paths in [config.json](/config.json) to point to your newly created crawler data files and the location of your Tracker Radar data repository

|   |   | 
|---|---|
|trackerDataLoc|path to your Tracker Radar data repository|
|crawlerDataLoc|path to your crawler data directory|
|performanceDataLoc|path to your performance crawler data|
|nameserverListLoc|path to your nameserver to entity file|
|siteRankListLoc|path to your list of ranked domains for calculating weightedRank and relativeRank

## Generating Tracker Radar data

- Install dependencies

`npm install`

- Build site performance summary (optional)

`npm run build-performance`

- Update entity data (optional) note: requires some manual validation of the output data, see [here](/src/entities/README.md) for more info
```
npm run update-entities
npm run apply-entity-changes
```

- Build Tracker Radar data files

`npm run build`

Note that if you wish to resolve CNAME's, node version 12+ is required. You can disable CNAME resolution by setting the option treatCnameAsFirstParty=true and keepFirstParty=false in the config file.

### Postgresql data source

Crawler data can also be read from a PostgreSQL database. To enable this, set the `crawlerDataLoc` to `postgres`, and set the `crawlId` and `region` options in `config.json`.
Database details should be provided via environment variables, for example with `envdir`:

```
envdir /etc/ddg/dbenv/tracker_radar_readonly/ npm run build
```
See the [node-postgres documentation](https://node-postgres.com/features/connecting) for more details on connection options.

### Nameserver list file

To assign entity/domain ownership using groups of nameservers you can provide a nameserver list file.

The format of the nameserver list is:

```
[
    {
        "name": "entity name, must match name in Tracker Radar /entities file"
        "nameservers": [
            nameserver1,
            nameserver2,
            ...
        ]
    }
]
```

## Contributing

### Reporting bugs

1. Check to see if the bug has not already been [reported](https://github.com/duckduckgo/tracker-radar-detector/issues)
2. Create a bug report [issue](https://github.com/duckduckgo/tracker-radar-detector/issues/new?template=bug_report.md)

### New features

Right now all new feature development is handled internally.

### Bug fixes

Most bug fixes are handled internally, but we will accept pull requests for bug fixes if you first:
1. Create an issue describing the bug.
2. Get approval from DDG staff before working on it. Since most bug fixes and feature development are handled internally, we want to make sure that your work doesn't conflict with any current projects

## Questions or help with anything else DuckDuckGo related?
See [DuckDuckGo Help Pages](https://help.duckduckgo.com).


This software is licensed under the terms of the Apache License, Version 2.0 (see [LICENSE](LICENSE)).
