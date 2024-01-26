const puppeteer = require('puppeteer');
const fs = require('fs');
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
(async () => {
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

  // 在找到元素後，你可以進行相應的操作，例如輸入值
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
  // https://pro.104.com.tw/psc2
  await page.goto('https://pro.104.com.tw/psc2');
  // companyName
  await page.waitForSelector('#companyName', { timeout });
  const punchElements = await page.$x(
    "//span[@class='btn btn-lg btn-block'][contains(., '打卡')]"
  );
  for (const punchElement of punchElements) {
    await punchElement.evaluate((b) => b.click());
    await delay(3000);
  }

  log('打卡成功！');

  // 在這裡可以進行登入後的操作

  await browser.close(); // 關閉瀏覽器
})();
