const fs = require('fs');

class JSONFileDataReader {
    constructor(path) {
        this.path = path;
        this._fileList = null;
    }

    async getFileList() {
        if (!this._fileList) {
            this._fileList = await fs.promises.readdir(this.path);
        }
        return this._fileList;
    }

    async length() {
        return (await this.getFileList()).length - 1;
    }

    async * iterator() {
        for (const file of await this.getFileList()) {
            const siteData = JSON.parse(await fs.promises.readFile(`${this.path}/${file}`, 'utf8'));
            if (siteData.initialUrl) {
                yield siteData;
            }
        }
    }
}

module.exports = {
    JSONFileDataReader,
}
