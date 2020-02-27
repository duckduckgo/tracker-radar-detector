Scripts in this folder extract, group and process performance data from crawl files.

## Metrics

* _caching time (s)_ - how long resource can be cached by a client without revalidation. Value based on `cache-control`, `expires` and `pragma` headers.
* _request download time (ms)_ - time between when request is made and when it's fully downloaded. Doesn't take redirects into account. 
* _request size (bytes)_ - encoded size (actual transferred size) including headers.
* _CPU time (ms)_ - CPU time spent on script parsing, compiling and evaluation on the main thread.

## Process

1. For each crawl file extract performance metrics of all third party resources. (`group_data.js`)

2. Group collected values from all crawl files by TLD. (`group_data.js`)

3. Based on grouped data, calculate average values for each TLD. (`create_stats.js`)

3. Calculate and assign 1-3 score per metric (`create_stats.js`)

    - For CPU, request size and request download time:
        - get all average values across all TLDs,
        - filter out outliners (all values over `avg + 2 * sd`),
        - find minimum and maximum in the remaining set,
        - split remaining min-max range into 3 equal parts (buckets),
        - give all TLDs that have a value that falls into the first bucket score 1, second bucket score 2 and third bucket score 3.

    - For caching time:
        - give every TLD with average caching time below a week score 3,
        - give every TLD with average caching time equal or grater than a week score 1.