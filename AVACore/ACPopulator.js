import fs from "fs";
import readline from "readline";
import { terminalPrefix, getSeedFilesNames, progressAnimation } from "./ACUtil";
import { AFDatabase, AFStorage } from "../AVAFoundation/index";
import { UUID } from "../AVAFoundation/AFUtil";


/**
 * @author Lawrence Bensaid <lawrencebensaid@icloud.com>
 */
class ACPopulator {

  constructor() {
    const basePath = `${projectPWD}/app/migration`;
    const oldPath = `${basePath}/seeds`;
    const newPath = `${basePath}/population`;
    if (fs.existsSync(oldPath)) {
      console.log(`${terminalPrefix()}\x1b[33m WARNING: '/migration/seeds/' is deprecated! Upgrading project structure...\x1b[0m`);
      try {
        fs.renameSync(oldPath, newPath);
      } catch (error) {
        console.log(`${terminalPrefix()}\x1b[34m Unable to move '/migration/seeds/' to '/migration/population/'.\x1b[0m`);
      }
    }
    this.seeds = [];
    const seedFiles = getSeedFilesNames();
    for (const i in seedFiles) {
      const fileName = seedFiles[i];
      const path = `${newPath}/${fileName}.json`;
      if (fs.existsSync(path)) {
        const fileSeeds = require(path);
        for (const i in fileSeeds) {
          this.seeds.push(fileSeeds[i]);
        }
      }
    }
  }


  async seed(mode, callback) {
    switch (mode) {
      case "SAFE": await this.execute({ wipe: false, onReady: callback }); break;
      case "OVERWRITE": await this.execute({ wipe: false, onReady: callback }); break;
      case "WIPE": await this.execute({ wipe: true, onReady: callback }); break;
    }
  }


  /**
   * @description Wipes the data in the storage and database. Then seeds.
   */
  async execute(options) {
    const ready = options ? typeof options.onReady === "function" ? options.onReady : () => { } : () => { };
    const wipe = options ? typeof options.wipe === "boolean" ? options.wipe : false : false;
    readline.cursorTo(process.stdout, 0);
    var permissionIssue = false;
    const database = new AFDatabase(environment.getDBCredentials());
    database.foreignKeyChecks = false;
    var seedStats = {};
    const that = this;
    if (wipe) {
      await database.wipeAllData();
      try {
        readline.cursorTo(process.stdout, 0);
        console.log(`${terminalPrefix()}\x1b[32m Storage wiped.\x1b[0m`);
        AFStorage.wipe();
      } catch (error) {
        if (error.code === "EPERM") {
          // permissionIssue = true; // Should be uncommented, BUT the issue can't be resolved and the warning is very annoying.
        } else {
          console.log(`${terminalPrefix()}\x1b[31m (error)\x1b[0m ${error}`);
        }
      }
    }
    await proceed();
    var animation;
    async function proceed() {
      animation = progressAnimation(`\x1b[34mPopulating (0/${that.seeds.length})`);
      const seeds = {};;
      for (const seed of that.seeds) {
        if (seed.hasOwnProperty("model")) {
          const Model = require(`${process.env.PWD}/app/models/${seed.model}.js`).default;
          seedStats[Model.NAME] = null;
          seeds[Model.NAME] = [];
          // Render placeholders.
          for (const row of seed.data) {
            for (const property in row) {
              const value = row[property]
              if (value === "<#UUID#>") {
                row[property] = new UUID().string;
              }
            }
          }
          // Convert model property names to column names.
          var r = 0;
          for (const record of seed.data) {
            seeds[Model.NAME][r] = {};
            for (const key in Model.PROPERTIES) {
              for (const attribute in record) {
                if (attribute == key) {
                  seeds[Model.NAME][r][Model.PROPERTIES[key].name] = record[attribute];
                }
              }
            }
            r++;
          }
        }
      }
      for (const table in seeds) {
        const data = seeds[table];
        try {
          await database.insertInto(table, data, { force: wipe });
          seedStats[table] = true;
        } catch (error) {
          seedStats[table] = false;
          switch (error.code) {
            case "ER_NOT_SUPPORTED_AUTH_MODE":
              console.log(`${terminalPrefix()}\x1b[31m (error) Database doesn't support authentication protocol. Consider upgrading your database.\x1b[0m`);
              break;
            case "ER_ACCESS_DENIED_ERROR":
              console.log(`${terminalPrefix()}\x1b[31m (error) Access to database was denied.\x1b[0m`);
              break;
            case "ER_NO_SUCH_TABLE":
              console.log(`${terminalPrefix()}\x1b[31m (error) Table '${table}' (of model '${seed.model}') not found. Migrate before populating.\x1b[0m`);
              break;
            default:
              console.log(`${terminalPrefix()}\x1b[31m (error) Error while populating '${table}':\x1b[0m ${error.message}`);
          }
        }
        update({ table });
        await new Promise((resolve, reject) => { setTimeout(() => { resolve(); }, 50) }); // Wait for a bit
      }
      if (permissionIssue) {
        console.log(`${terminalPrefix()}\x1b[33m (warning) Some files or folders weren't deleted because Avalanche doesn't have the right permissions.\x1b[0m`);
      }
    }
    function update({ table }) {
      var completed = 0;
      var successful = 0;
      for (const key in seedStats) {
        if (seedStats[key] !== null) completed++;
        if (seedStats[key] === true) successful++;
      }
      clearInterval(animation);
      animation = progressAnimation(`\x1b[34mPopulating (${successful}/${completed})${table ? ` [${table}]` : ""}                              `);
      if (completed === Object.keys(seedStats).length) {
        clearInterval(animation);
        console.log(`${terminalPrefix()}\x1b[32m Populating complete. (${completed}/${successful} tables populated)\x1b[0m`);
        ready(true);
      }
    }
  }

}


export default ACPopulator;