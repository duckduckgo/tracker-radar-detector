const fs = require('fs')
const {gunzip} = require('zlib')
const {Client} = require('pg')
const Cursor = require('pg-cursor')
const {promisify} = require('util')

const dogunzip = promisify(gunzip)

class JSONFileDataReader {
    constructor(path) {
        this.path = path
        this._fileList = null
    }

    async getFileList() {
        if (!this._fileList) {
            this._fileList = await fs.promises.readdir(this.path)
        }
        return this._fileList
    }

    async length() {
        return (await this.getFileList()).length - 1
    }

    async *iterator() {
        for (const file of await this.getFileList()) {
            // transparently expand gzipped files
            const fileData = file.endsWith('.gz')
                ? (await dogunzip(await fs.promises.readFile(`${this.path}/${file}`))).toString('utf-8')
                : fs.promises.readFile(`${this.path}/${file}`, 'utf8')
            const siteData = JSON.parse(fileData)
            if (siteData.initialUrl) {
                yield siteData
            }
        }
    }

    async close() {}
}

class PostgresDataReader {
    constructor(crawlId, region) {
        this.crawlId = crawlId
        this.region = region
        this._client = new Client()
        this._connected = this._client.connect()
    }

    async close() {
        await this._client.end()
    }

    async length() {
        await this._connected
        const res = await this._client.query(
            'SELECT COUNT(*) FROM crawler WHERE crawl_id = $1 and region = $2',
            [this.crawlId, this.region]
        )
        return parseInt(res.rows[0].count, 10)
    }

    async *iterator() {
        await this._connected
        const query = `
        SELECT
            initialUrl AS "initialUrl",
            finalUrl AS "finalUrl",
            rank, timeout, started, finished, data
        FROM crawler WHERE crawl_id = $1 and region = $2
        ORDER BY initialUrl ASC
        `
        const cursor = this._client.query(new Cursor(query, [this.crawlId, this.region]))
        const readBatch = promisify(cursor.read.bind(cursor, 100))
        let resultBatch
        do {
            resultBatch = await readBatch()
            for (const row of resultBatch) {
                // fix for quoted urls
                if (row.initialUrl.trim().startsWith('"')) {
                    row.initialUrl = row.initialUrl.substring(1, row.initialUrl.length - 1)
                    row.finalUrl = row.finalUrl.substring(1, row.finalUrl.length - 1)
                }
                // cast timestamps to int
                row.started = parseInt(row.started, 10)
                row.finished = parseInt(row.finished, 10)
                yield row
            }
        } while (resultBatch.length > 0)
        cursor.close()
    }
}

module.exports = {
    JSONFileDataReader,
    PostgresDataReader,
}
