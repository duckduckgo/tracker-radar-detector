#!/bin/bash
set -ex

TRI=`pwd`
TR_PATH=$1
cd $TR_PATH

for TAG in $(git tag -l | sort -r)
do
    cd $TRI
    bash clickhouse/insert-data.sh $TR_PATH $TAG
done