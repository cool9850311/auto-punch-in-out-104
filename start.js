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
  fs.appendFileSync(logPath, `${new Date()} - ${message}\n`);
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
    log('Error reading folder:', err);
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
      moment(day.start).isSame(today, 'day')
    ) {
      return true;
    }
  }
  for (const day of Object.values(holiday)) {
    if (day?.summary === undefined || day?.start === undefined) {
      continue;
    }
    if (moment(day.start).isSame(today, 'day')) {
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
(async () => {
  if (!(await executeToday())) {
    log('Happy Holiday~');
    return;
  }
  log('cronjob started');
  const browser = await puppeteer.launch({ headless: false }); // 啟動 headless 瀏覽器
  const page = await browser.newPage(); // 打開一個新分頁
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
  );
  await page.goto('https://bsignin.104.com.tw/login'); // 前往登入頁面
  const cookiesFilePath = './cookies.json';
  const previousSession = fs.existsSync(cookiesFilePath);
  if (previousSession) {
    // If file exist load the cookies
    const cookiesString = fs.readFileSync(cookiesFilePath);
    const parsedCookies = JSON.parse(cookiesString);
    if (parsedCookies.length !== 0) {
      for (let cookie of parsedCookies) {
        await page.setCookie(cookie);
      }
      log('Session has been loaded in the browser');
    }
  }

  await page.waitForSelector('[data-qa-id="loginUserName"]', { timeout });

  const userNameElement = await page.$('[data-qa-id="loginUserName"]');
  const passwordElement = await page.$('[data-qa-id="loginPassword"]');
  const loginButtonElement = await page.$('[data-qa-id="loginButton"]');
  await userNameElement.type(userName);
  await passwordElement.type(password);
  await page.click('label.Login__checkboxStyle');
  await loginButtonElement.click();
  if (!previousSession) {
    await delay(60000);
  }

  const cookiesObject = await page.cookies();
  // Write cookies to temp file to be used in other profile pages
  fs.writeFile(cookiesFilePath, JSON.stringify(cookiesObject), function (err) {
    if (err) {
      log('The file could not be written.', err);
    }
    log('Session has been successfully saved');
  });
  await delay(3000);
  log('登入成功！');
  await page.goto('https://pro.104.com.tw/psc2');
  await page.waitForSelector('#companyName', { timeout });
  const [punchElement] = await page.$x(
    "//span[@class='btn btn-lg btn-block'][contains(., '打卡')]"
  );
  await punchElement.evaluate((b) => b.click());
  // TODO: Should verify with waitForResponse or element
  await delay(3000);
  //
  log('打卡成功！');

  await browser.close();
})();
