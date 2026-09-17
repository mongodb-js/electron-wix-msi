const path = require('path');

const { MSICreator } = require('../lib/index');

const APP_DIR = path.join(__dirname, 'app');
const OUT_DIR = path.join(__dirname, 'out');

async function harness() {
  const msiCreator = new MSICreator({
    appDirectory: APP_DIR,
    exe: 'slack',
    manufacturer: 'Slack Technologies',
    name: 'Slack',
    outputDirectory: OUT_DIR,
    description: 'Test',
    ui: {
      chooseDirectory: true,
    },
    version: '1.2.3.4',
  });

  await msiCreator.create();
  await msiCreator.compile();
}

harness();
