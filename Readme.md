# 104 Auto Punch in/out

## Features

- Auto login & Punch in/out

## Prerequisites

- Node environment ([Node.js](https://nodejs.org/))

## Setup

1. Clone the repository:

   ```sh
   git clone <repository-url>
   ```

2. Replace the following constants with your own user name and password in the `start.js` file:

   ```javascript
   const userName = 'YOUR_USERNAME';
   const password = 'YOUR_PASSWORD';
   ```

3. Replace the following path with your own (must be an absolute path) in the `cron.bash` file:

   ```bash
   #!/bin/bash
   cd path-to-this-directory
   path-to-node/node start.js
   ```

   If you don't know your Node.js path, you can find it by running:

   ```sh
   which node
   ```

4. Install npm packages:

   ```sh
   npm install
   ```

5. Make the bash script executable:

   ```sh
   chmod +x path-to-bash-file/cron.bash
   ```

6. Test it by running:

   ```sh
   bash path-to-bash-file/cron.bash
   ```

   You will have to receive an email OTP manually for the first time login. The Chrome browser will wait for about 1 minute for you to type and submit the OTP. After sending it, just wait till the end.

7. Check if your punch card is correct.

8. Add cronjobs to punch in/out:
   Run:

   ```sh
   crontab -e
   ```

   Edit the file:

   ```sh
   0 9 * * 1-5 /bin/bash path-to-bash-file/cron.bash
   5 18 * * 1-5 /bin/bash path-to-bash-file/cron.bash
   ```

   Save and exit.

   If you don't know how to use VIM, check out this [Tutorial](https://opensource.com/article/19/3/getting-started-vim).
