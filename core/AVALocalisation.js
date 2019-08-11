// Dependencies
const fs = require("fs");
const projectPWD = process.env.PWD;


/**
 * 
 */
class AVALocalisation {

    constructor(locale) {

        var normalizedPath = `${projectPWD}/app/localisations`;
        var localisations = [];
        fs.readdirSync(normalizedPath).forEach(function (file) {
            const extensions = file.split(".");
            if(extensions.length === 2)
                if(extensions[extensions.length - 1].toUpperCase() === "JSON")
                    localisations[extensions[0]] = require(`${projectPWD}/app/localisations/${file}`);
        });
        this.list = localisations[locale];
    }

    getList() {
        return this.list;
    }

}

module.exports = AVALocalisation;