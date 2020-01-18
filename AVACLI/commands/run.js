import fs from "fs";
import path from "path";
import inquirer from "inquirer";
import readline from "readline";
import { exec, execSync } from "child_process";
import { AFEnvironment } from "../../AVAFoundation/index";
import { directoryLooper } from "../../AVAFoundation/AFUtil";
import * as ACUtil from "../../AVACore/ACUtil";

const pkg = fs.existsSync(`${projectPWD}/package.json`) ? require(`${projectPWD}/package.json`) : undefined;


/**
 * @description Runs your Avalanche application.
 */
function run() {
  if (ACUtil.getRoutes().length < 1) {
    console.log(`${ACUtil.terminalPrefix()}\x1b[34m (notice) Your app has no routes. (You might want to add some)\x1b[0m`);
  }
  var environmentName = null;
  if (typeof arguments[0] === "string") {
    environmentName = arguments[0];
  } else {
    if (pkg && pkg.avalancheConfig && pkg.avalancheConfig.preferredEnvironment) {
      environmentName = pkg.avalancheConfig.preferredEnvironment;
    } else {
      environmentName = null;
    }
  }
  global.environment = new AFEnvironment(environmentName);
  var watchers = [];
  const stopP = () => {
    for (const watcher of watchers) {
      watcher.close();
    }
    cProcess.kill("SIGTERM");
  };
  var cProcess = start(environmentName, stopP);
  setTimeout(() => {
    if (environment.debug.restartOnFileChange) {
      const directory = `${projectPWD}/app`;
      const folders = directoryLooper(directory, []).children;
      for (const i in folders) {
        const folder = folders[i];
        if (fs.lstatSync(folder).isDirectory()) {
          const files = fs.readdirSync(folder);
          for (const i in files) {
            const file = files[i];
            const filePath = `${folder}/${file}`;
            if (fs.lstatSync(filePath).isFile()) {
              const watcher = ACUtil.startWatchingSession(filePath, () => {
                process.stdout.moveCursor(0, -2);
                process.stdout.cursorTo(0);
                process.stdout.clearScreenDown();
                cProcess.kill("SIGTERM");
                cProcess = start(environmentName, stopP);
              });
              watchers.push(watcher);
            }
          }
        }
      }
    }
  }, 0);
}


/**
 * @description Starts up the server.
 * @param {String} environment 
 */
function start(environment, onStop) {
  const animation = progressAnimation("Serving");
  const stop = typeof onStop === "function" ? onStop : () => { };
  const environmentFormatted = typeof environment === "string" ? environment.split(" ").join("").trim() : undefined;
  const mainPath = path.normalize(`${__dirname}/../../AVACore/main.js`);
  const command = environmentFormatted ? `node "${mainPath}" run ${environmentFormatted}` : `node "${mainPath}" run`;
  const cProcess = exec(command, (error, stdout, stderr) => {
    if (error) {
      if (error.signal === "SIGINT") {
        return;
      }
    }
  });
  cProcess.stdout.on("data", (data) => {
    if (data.includes("Webserver served")) {
      readline.cursorTo(process.stdout, 0);
      clearInterval(animation);
    }
    if (data.includes("Unable to start server")) {
      readline.cursorTo(process.stdout, 0);
      clearInterval(animation);
    }
    if (data.includes("[EACCESS]")) {
      setTimeout(() => {
        cProcess.kill();
      }, 0);
      troubleshootHost(environment, "EACCESS", cProcess, stop);
    }
    if (data.includes("[EADDRINUSE]")) {
      setTimeout(() => {
        cProcess.kill();
      }, 0);
      troubleshootPort(environment, "EADDRINUSE", cProcess, stop);
    }
    console.log(data.toString().trim());
  });
  cProcess.stderr.on("data", (data) => {
    console.log(`${ACUtil.terminalPrefix()}\x1b[31m (FAILURE) \n\n\n\x1b[33m${data.toString().trim()}\n\n\x1b[0m`);
    const questions = [
      {
        type: "list",
        name: "action",
        choices: ["restart", "exit"],
        message: "\x1b[31mThe application crashed",
        prefix: `${ACUtil.terminalPrefix()}\x1b[3m`,
        suffix: "\x1b[0m"
      }
    ];
    inquirer.prompt(questions).then(answers => {
      if (answers.action === "restart") {
        cProcess.kill();
        start(environment, stop);
      } else {
        stop();
      }
    });
  });
  cProcess.on("close", (code, signal) => {
    // console.log(`${ACUtil.terminalPrefix()}\x1b[31m Server stopped. \x1b[1m(${signal})\x1b[0m`);
  });
  return cProcess;
}

function progressAnimation(title) {
  var iteration = 0;
  const name = "avalanche"
  return setInterval(() => {
    var progressBar = "";
    iteration = (iteration + 1) % (name.length + 1);
    // const barPos = (name.length + 1) - iteration; // Reverse direction

    for (let i = 0; i < iteration; i++) {
      progressBar += name[i].toUpperCase();
    }
    for (let i = iteration; i < name.length; i++) {
      progressBar += name[i];
    }

    process.stdout.write(`\x1b[36m\x1b[1m[\x1b[34m${progressBar}\x1b[36m]\x1b[0m \x1b[32m${title}\x1b[0m`);
    readline.cursorTo(process.stdout, 0);
  }, 100);
}

function troubleshootHost(environment, error, cProcess, onStop) {
  const stop = typeof onStop === "function" ? onStop : () => { };
  const filePath = `${projectPWD}/app/environments/${environment}.environment.json`;
  const port = JSON.parse(fs.readFileSync(filePath, "utf8")).network.port;
  var choices = [
    "Change host IP to 0.0.0.0",
    "retry"//,
    // "exit"
  ];
  if (error === "EADDRINUSE" && (process.platform === "darwin" || process.platform === "linux")) {
    choices.splice(1, 0, `Kill process on port ${port}`);
  }
  const questions = [
    {
      type: "list",
      name: "action",
      choices: choices,
      message: "\x1b[31mOptions",
      prefix: `${ACUtil.terminalPrefix()}\x1b[3m`,
      suffix: "\x1b[0m"
    }
  ];
  setTimeout(() => {
    inquirer.prompt(questions).then(answers => {
      if (answers.action === "Change host IP to 0.0.0.0") {
        const filePath = `${projectPWD}/app/environments/${environment}.environment.json`;
        var json = JSON.parse(fs.readFileSync(filePath, "utf8"));
        json.network.host = "0.0.0.0";
        fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf8");
        cProcess.kill();
        start(environment, stop);
      }
      if (answers.action === `Kill process on port ${port}`) {
        killAllNodeProcesses(port);
        start(environment, stop);
      }
      if (answers.action === "retry") {
        cProcess.kill();
        start(environment, stop);
      }
      if (answers.action === "exit") {
        stop();
        cProcess.kill("SIGTERM");
      }
    });
  }, 0);
}

function troubleshootPort(environment, error, cProcess, onStop) {
  const stop = typeof onStop === "function" ? onStop : () => { };
  const filePath = `${projectPWD}/app/environments/${environment}.environment.json`;
  const port = JSON.parse(fs.readFileSync(filePath, "utf8")).network.port;
  var choices = [
    // "Change port to 8080", // NOTE: Doesn't work for some reason.
    "retry"//,
    // "exit"
  ];
  if (process.platform === "darwin" || process.platform === "linux") {
    choices.splice(0, 0, `Kill process on port ${port}`);
  }
  const questions = [
    {
      type: "list",
      name: "action",
      choices: choices,
      message: "\x1b[31mOptions",
      prefix: `${ACUtil.terminalPrefix()}\x1b[3m`,
      suffix: "\x1b[0m"
    }
  ];
  setTimeout(() => {
    inquirer.prompt(questions).then(answers => {
      const filePath = `${projectPWD}/app/environments/${environment}.environment.json`;
      var json = JSON.parse(fs.readFileSync(filePath, "utf8"));
      json.network.host = "0.0.0.0";
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf8");
      if (answers.action === `Kill process on port ${port}`) {
        killAllNodeProcesses(port);
        start(environment, stop);
      }
      // NOTE: Doesn't work for some reason.
      // if (answers.action === `Change port to 8080`) {
      //   const filePath = `${projectPWD}/app/environments/${environment}.environment.json`;
      //   var json = JSON.parse(fs.readFileSync(filePath, "utf8"));
      //   json.network.port = 8080;
      //   fs.writeFileSync(filePath, JSON.stringify(json, null, 2), "utf8");
      //   start(environment, stop);
      // }
      if (answers.action === "retry") {
        start(environment, stop);
      }
      if (answers.action === "exit") {
        stop();
        cProcess.kill("SIGTERM");
      }
    });
  }, 0);
}

function killAllNodeProcesses(port) {
  try {
    const output = execSync(`lsof -i tcp:${port}`, { stdio: "pipe" }).toString();
    const rows = output.split("\n");
    var pids = [];
    for (const row of rows) {
      const rowCells = row.replace(/ +(?= )/g, "").trim().split(" ");
      for (let i = 0; i < rowCells.length; i++) {
        const cell = rowCells[i];
        if (cell === "node" && rowCells.length > i) {
          pids.push(rowCells[i + 1]);
          break;
        }
      }
    }
    for (const pid of pids) {
      console.log(`${ACUtil.terminalPrefix()}\x1b[33m Killing ${pid}\x1b[0m`);
      execSync(`kill ${pid}`, { stdio: "pipe" }).toString();
    }
  } catch (error) {
  }
}


module.exports.execute = run;
module.exports.enabled = true;
module.exports.scope = "PROJECT";
module.exports.command = "run";
module.exports.description = "Runs your application.";