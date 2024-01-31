CREATE DATABASE IF NOT EXISTS tracker_radar;
USE tracker_radar;

CREATE TABLE IF NOT EXISTS domain_json
(
    tag String,
    region String,
    filename String,
    data String
)
ENGINE = MergeTree()
PRIMARY KEY (tag, region, filename);

CREATE TABLE IF NOT EXISTS entity_json
(
    tag String,
    filename String,
    data String
)
ENGINE = MergeTree()
PRIMARY KEY (tag, filename);

CREATE VIEW IF NOT EXISTS domain_summary
AS
SELECT
    tag,
    region,
    JSONExtractString(data, 'domain') AS domain,
    JSONExtract(data, 'owner', 'Tuple(name String, displayName String, privacyPolicy String, url String)') AS owner,
    JSONExtract(data, 'source', 'Array(String)') AS source,
    JSONExtractFloat(data, 'prevalence') AS prevalence,
    JSONExtractUInt(data, 'sites') AS sites,
    JSONExtract(data, 'subdomains', 'Array(String)') AS subdomains,
    JSONExtractUInt(data, 'fingerprinting') AS fingerprinting,
    JSONExtract(data, 'categories', 'Array(String)') AS categories,
    JSONExtractFloat(data, 'cookies') AS cookies,
    JSONExtract(data, 'nameservers', 'Array(String)') AS nameservers,
    JSONExtract(data, 'cnames', 'Array(Tuple(original String, resolved String))') AS cnames,
    JSONExtract(data, 'topInitiators', 'Array(Tuple(domain String, prevalence Float32))') AS topInitiators,
    JSONExtractKeysAndValues(data, 'types', 'UInt32') AS types
FROM domain_json;

CREATE MATERIALIZED VIEW domain_resources ENGINE = MergeTree() ORDER BY (tag, region, domain) POPULATE
AS
SELECT
    tag,
    region,
    domain,
    JSONExtractString(resource, 'rule') AS rule,
    JSONExtractFloat(resource, 'cookies') AS cookies,
    JSONExtractUInt(resource, 'fingerprinting') AS fingerprinting,
    JSONExtract(resource, 'subdomains', 'Array(String)') AS subdomains,
    JSONExtractUInt(resource, 'sites') AS sites,
    JSONExtractFloat(resource, 'prevalence') AS prevalence,
    JSONExtractString(resource, 'type') AS type,
    JSONExtract(resource, 'exampleSites', 'Array(String)') AS exampleSites,
    JSONExtract(resource, 'responseHashes', 'Array(String)') AS responseHashes,
    JSONExtractKeysAndValues(resource, 'firstPartyCookies', 'Tuple(ttl UInt32, length UInt16, prevalence Float32, uniqueness Float32)') AS firstPartyCookies,
    JSONExtractKeysAndValues(resource, 'firstPartyCookiesSent', 'Float32') AS firstPartyCookiesSent,
    JSONExtractKeysAndValues(resource, 'apis', 'UInt32') AS apis
FROM (
    SELECT tag, region, JSONExtractString(data, 'domain') AS domain, JSONExtractArrayRaw(data, 'resources') AS resource
    FROM domain_json
) ARRAY JOIN resource;

-- CREATE MATERIALIZED VIEW firstPartyCookies ENGINE = MergeTree() ORDER BY (tag, region, domain, rule, cookieName) POPULATE
CREATE VIEW firstPartyCookies
AS
SELECT
    tag, region, domain, rule, type, 
    firstPartyCookies.1 AS cookieName,
    firstPartyCookies.2.1 AS ttl,
    firstPartyCookies.2.2 AS length,
    firstPartyCookies.2.3 AS prevalence,
    firstPartyCookies.2.4 AS uniqueness
FROM domain_resources
ARRAY JOIN firstPartyCookies;

-- CREATE MATERIALIZED VIEW firstPartyCookiesSent ENGINE = MergeTree() ORDER BY (tag, region, domain, rule, cookieName) POPULATE
CREATE VIEW firstPartyCookiesSent
AS
SELECT
    tag, region, domain, rule, type, 
    firstPartyCookiesSent.1 AS cookieName,
    firstPartyCookiesSent.2 AS prevalence
FROM domain_resources
ARRAY JOIN firstPartyCookiesSent;

CREATE VIEW IF NOT EXISTS entity_summary
AS 
SELECT
    tag,
    JSONExtractString(data, 'name') AS name,
    JSONExtractString(data, 'displayName') AS displayName,
    JSONExtract(data, 'properties', 'Array(String)') AS properties,
    JSONExtract(data, 'prevalence', 'Tuple(tracking Float32, nonTracker Float32, total Float32)') AS prevalence
FROM entity_json

CREATE VIEW resource_apis
AS
SELECT
    tag, region, domain, rule, type, fingerprinting,
    apis.1 AS api,
    apis.2 AS count
FROM domain_resources
ARRAY JOIN apis;
