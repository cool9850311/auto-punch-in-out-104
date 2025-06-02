const puppeteer = require('puppeteer');
const moment = require('moment');
const ical = require('node-ical');
const fs = require('fs');
const path = require('path');
const userName = 'YOUR_USERNAME';
const password = 'YOUR_PASSWORD';
const timeout = 10000;

async function log(message) {
  const logPath = './log.txt';
  try {
    fs.appendFileSync(logPath, `${new Date().toISOString()} - ${message}\n`);
    console.log(message);
  } catch (logError) {
    console.error(`Error writing to log: ${logError}`);
  }
}
function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}
async function executeToday() {
  const fsPromise = require('fs').promises;
  let icsFileName;
  try {
    const files = await fsPromise.readdir(__dirname); // 使用 await 等待 readdir 结果
    // 檢查每個檔案是否以 .ics 副檔名結尾
    const icsFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === '.ics'
    );

    if (icsFiles.length === 1) {
      icsFileName = icsFiles[0];
    }
  } catch (err) {
    log('Error reading folder:' + err);
    return true; // Return true on error to continue execution
  }

  if (!icsFileName) {
    return true;
  }

  const holiday = ical.sync.parseFile(icsFileName);
  const today = moment().format('YYYY-MM-DD');
  for (const day of Object.values(holiday)) {
    if (day?.summary === undefined || day?.start === undefined) {
      continue;
    }
    if (
      day.summary.includes('補班') &&
      moment().isBetween(moment(day.start), moment(day.end), undefined, '[)')
    ) {
      return true;
    }
  }
  for (const day of Object.values(holiday)) {
    if (day?.summary === undefined || day?.start === undefined) {
      continue;
    }
    if (
      moment().isBetween(moment(day.start), moment(day.end), undefined, '[)')
    ) {
      return false;
    }
    if (day.rrule) {
      const rruleDates = day.rrule.between(
        day.start,
        moment().add(1, 'year').toDate()
      );
      for (const rruleDate of rruleDates) {
        if (moment(rruleDate).isSame(today, 'day')) {
          return false;
        }
      }
    }
  }
  return true;
}

// Main function with proper error handling
(async () => {
  let browser = null;
  try {
    log('=== 104 Punch-in Script Started ===');
    
    if (!(await executeToday())) {
      log('Happy Holiday~');
      return;
    }
    
    log('cronjob started');
    try {
      log('Launching browser...');
      browser = await puppeteer.launch({ 
        headless: false,
        executablePath: process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined,
        args: [],
        ignoreHTTPSErrors: true,
        timeout: 60000
      });
      log('Browser launched successfully');
    } catch (browserError) {
      log(`Error launching browser: ${browserError.message}`);
      log(`Browser launch error stack: ${browserError.stack}`);
      throw browserError;
    }
    
    const page = await browser.newPage(); // 打開一個新分頁
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Register error handler for page errors
    page.on('error', err => {
      log(`Page error: ${err}`);
    });
    
    // Register console message handler
    page.on('console', msg => {
      log(`Page console ${msg.type()}: ${msg.text()}`);
    });
    
    try {
      await page.goto('https://bsignin.104.com.tw/login', { waitUntil: 'networkidle2' }); // 前往登入頁面
    } catch (navigateError) {
      log(`Navigation error: ${navigateError}`);
      throw navigateError;
    }
    
    const cookiesFilePath = './cookies.json';
    const previousSession = fs.existsSync(cookiesFilePath);
    if (previousSession) {
      try {
        // If file exist load the cookies
        const cookiesString = fs.readFileSync(cookiesFilePath);
        const parsedCookies = JSON.parse(cookiesString);
        if (parsedCookies.length !== 0) {
          for (let cookie of parsedCookies) {
            await page.setCookie(cookie);
          }
          log('Session has been loaded in the browser');
        }
      } catch (cookieError) {
        log(`Cookie loading error: ${cookieError}`);
        // Continue even if cookie loading fails
      }
    }

    try {
      await delay(1000);
      await page.waitForSelector('[data-qa-id="loginUserName"]', { timeout });

      const userNameElement = await page.$('[data-qa-id="loginUserName"]');
      const passwordElement = await page.$('[data-qa-id="loginPassword"]');
      const loginButtonElement = await page.$('[data-qa-id="loginButton"]');
      await delay(3000);
      if (userNameElement && passwordElement && loginButtonElement) {
        await userNameElement.type(userName);
        await delay(1000);
        await passwordElement.type(password);
        await delay(1000);
        await page.click('label.MultipleLogin__checkboxStyle');
        await loginButtonElement.click();
        if (!previousSession) {
          await delay(60000);
        }
      } else {
        throw new Error('Login elements not found');
      }

      const cookiesObject = await page.cookies();
      // Write cookies to temp file to be used in other profile pages
      fs.writeFile(cookiesFilePath, JSON.stringify(cookiesObject), function (err) {
        if (err) {
          log('The file could not be written.' + err);
        } else {
          log('Session has been successfully saved');
        }
      });
      
      await delay(3000);
      log('登入成功！');
      
      try {
        await page.goto('https://pro.104.com.tw/psc2', { waitUntil: 'networkidle2' });
        
        await page.waitForSelector('#companyName', { timeout });
        await delay(1000);
        const punchElements = await page.$x(
          "//span[@class='btn btn-lg btn-block'][contains(., '打卡')]"
        );
        
        if (punchElements.length > 0) {
          await punchElements[0].evaluate((b) => b.click());
          // TODO: Should verify with waitForResponse or element
          await delay(3000);
          log('打卡成功！');
        } else {
          log('打卡按鈕未找到');
        }
      } catch (punchError) {
        log(`打卡错误: ${punchError}`);
        throw punchError;
      }
    } catch (loginError) {
      log(`登录错误: ${loginError}`);
      throw loginError;
    }
  } catch (error) {
    log(`Error occurred: ${error.message}`);
    if (error.stack) {
      log(`Error stack: ${error.stack}`);
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
        log('Browser closed successfully');
      } catch (closeError) {
        log(`Error closing browser: ${closeError}`);
      }
    }
  }
})().catch(error => {
  console.error('Top-level error:', error);
  process.exit(1);
});
