#!/bin/bash
set -ex

REPO_PATH=`pwd`
TR_PATH=$1
TAG=$2

cd $TR_PATH
git checkout $TAG
cd $REPO_PATH

node clickhouse/format-domain-data.mjs $TAG $TR_PATH | clickhouse-client \
    --host clickhouse \
    --query "
INSERT INTO tracker_radar.domain_json
SELECT tag, region, filename, data
FROM input('tag String, region String, filename String, data String')
FORMAT TabSeparated
"

node clickhouse/format-entity-data.mjs $TAG $TR_PATH | clickhouse-client \
    --host clickhouse \
    --query "
INSERT INTO tracker_radar.entity_json
SELECT tag, filename, data
FROM input('tag String, filename String, data String')
FORMAT TabSeparated
"
