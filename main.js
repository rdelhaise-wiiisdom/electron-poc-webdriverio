// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const webdriverio = require('webdriverio');
const es6Promise = require('es6-promise');
const {spawn} = require('child_process')
const waitPort = require('wait-port')


function startDriverBin(bin, port) {
  return new es6Promise.Promise((resolve, reject) => {
    try {
      const program = spawn(bin, [`--port=${port}`]);
      let isFirst = true;
      let stderr = '';
      program.stdout.on('data', data => {
        stderr += data.toString('utf8');
        console.log('WEBDRIVER STDERR', stderr);
        // This detects driver instance get ready.
        if (!isFirst) {
          return;
        }
        isFirst = false;

        waitPort({
          port,
          host: 'localhost',
          timeout: 3000, // 3s
        })
            .then(() => {
              return resolve(program);
            })
            .catch(err => {
              console.log(err);
              reject(new Error(`Failed to start ChromeDriver: ${err}`));
            });
      });
      program.stderr.on('data', data => {
        stderr += data.toString('utf8');
        console.log('WEBDRIVER STDERR', stderr);
      });
      program.on('error', err => {
        console.log('WEBDRIVER ERROR', err);
        if (!isFirst) {
          return;
        }
        isFirst = false;
        reject(err);
      });
      program.on('close', () => {
        console.log('BROWSER WINDOW CLOSED');
      });
      program.on('exit', code => {
        if (!isFirst) {
          return;
        }
        isFirst = false;
        if (code === 0) {
          // webdriver some cases doesn't use exit codes correctly :(
          if (stderr.indexOf('Error:') === 0) {
            console.log(stderr);
            reject(new Error(stderr));
          } else {
            resolve(program);
          }
        } else {
          console.log(`Exit code: ${code}`);
          reject(new Error(`Exit code: ${code}`));
        }
      });
    } catch (err) {
      console.log(err);
      reject(err);
    }
  });
}

async function communicate(){
  const driver = await startDriverBin('/Users/remydelhaise/Developpement/WOFT/electron-poc-webdriverio/resources/chromedriver', 4446);
  try {
    const browser = await webdriverio.remote({
      port: 4446,
      path: '/',
      connectionRetryCount: 0,
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [],
          // Don't install automation extension, installing extensions to chrome may require admin privileges
          useAutomationExtension: false,
          // Disable same site cookie enformcement because Tableau Server on Windows doesn't like it
          localState: {
            'browser.enabled_labs_experiments': [
              'same-site-by-default-cookies@2',
              'cookies-without-same-site-must-be-secure@2',
            ],
          },
          prefs: {
            directory_upgrade: true,
            // prompt_for_download: false,
            download: {
              default_directory: "",
            },
          },
        },
      },
      logLevel: 'silent',
    });
    const userAgent = await browser.executeAsync((done) => {
      done(navigator.userAgent);
    });
  } catch(e) {
    console.log("ERROR IN WEBDRIVER", e)
  }
}

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  ipcMain.on('open-chromedriver', communicate)

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
