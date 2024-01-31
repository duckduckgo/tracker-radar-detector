# Tracker Radar Clickhouse Database

This folder contains scripts and schemas for inserting Tracker Radar data into Clickhouse. This
allows for easy longitudial analysis of the data we publish on Github.

## Setup

If starting from scratch (no existing database), we first need to create the database and table/view
schemas:
```bash
cat clickhouse/schema.sql | clickhouse-client -h clickhouse --multiquery
```

## Data import

Given a checkout of [tracker-radar](https://github.com/duckduckgo/tracker-radar), we can import data
for a given tag as follows:
```bash
bash ./clickhouse/insert-tag.sh /path/to/tracker-radar 2023.03
```
In this case, we're importing the `2023.03` tag. After the import, you should be able to read the imported data in Clickhouse:
```
use-clickhouse1.duckduckgo.com :) select count(*) from domain_json where tag = '2023.03';

SELECT count(*)
FROM domain_json
WHERE tag = '2023.03'

Query id: b330bfd4-dfcf-449e-8a17-eb3151552163

┌─count()─┐
│   56921 │
└─────────┘

1 rows in set. Elapsed: 0.135 sec. Processed 56.92 thousand rows, 910.74 KB (420.42 thousand rows/s., 6.73 MB/s.)

use-clickhouse1.duckduckgo.com :) select count(*) from entity_json where tag = '2023.03';

SELECT count(*)
FROM entity_json
WHERE tag = '2023.03'

Query id: f6d77443-5667-467e-af6f-b63e80d3abbb

┌─count()─┐
│   18966 │
└─────────┘

1 rows in set. Elapsed: 0.134 sec. Processed 18.97 thousand rows, 303.46 KB (141.11 thousand rows/s., 2.26 MB/s.)
```

## Querying the data

### Example queries

Get the longitundal prevalence of a tracker domain in a specific region:
```sql
SELECT
    tag, region, domain, owner.1 as owner, prevalence
FROM domain_summary
WHERE region ='GB' AND domain = 'google-analytics.com'
ORDER BY tag DESC;
```

Get the longitundal prevalence of an entity:
```sql
SELECT
    tag, name, prevalence.3 as total_prevalence
FROM entity_summary
WHERE name = 'Microsoft Corporation'
ORDER BY tag DESC;
```

Find some high prevalence resources loaded by a site:
```sql
SELECT
    tag, region, domain, rule, type, prevalence
FROM domain_resources
WHERE region = 'US' AND has(exampleSites, 'theguardian.com')
ORDER BY prevalence DESC;
```

Check who sets the `_ga` cookie apart from `google-analytics.com`:
```sql
SELECT * 
FROM firstPartyCookies
WHERE domain != 'google-analytics.com' AND cookieName = '_ga'
ORDER BY prevalence DESC limit 10;
```
