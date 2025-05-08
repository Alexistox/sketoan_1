const Settings = require('../models/Settings');

const isTrc20Address = (str) => {
  const re = /^T[1-9A-Za-z]{33}$/;
  return re.test(str);
};

const handleTrc20Address = async (chatId, address, username, bot) => {
  try {
    // Save address to settings
    await Settings.findOneAndUpdate(
      { key: 'GLOBAL_USDT_ADDRESS' },
      { key: 'GLOBAL_USDT_ADDRESS', value: address },
      { upsert: true }
    );

    // Get all users who have used this address
    const transactions = await Settings.find({
      key: 'USDT_ADDRESS_USERS',
      'value.address': address
    });

    const userList = transactions.map(t => t.value.username);
    const uniqueUsers = [...new Set(userList)].join(", ");

    const msg = "USDT-TRC20地址:\n\n`" + address + "`\n\n交易前请向多人确认\n点击地址复制!";
    await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });

    // Log user who added the address
    await Settings.findOneAndUpdate(
      { key: 'USDT_ADDRESS_USERS' },
      { 
        key: 'USDT_ADDRESS_USERS',
        value: {
          address,
          username,
          timestamp: new Date()
        }
      },
      { upsert: true }
    );

    return true;
  } catch (error) {
    console.error('Error handling TRC20 address:', error);
    return false;
  }
};

const getGlobalUsdtAddress = async () => {
  try {
    const setting = await Settings.findOne({ key: 'GLOBAL_USDT_ADDRESS' });
    return setting ? setting.value : "";
  } catch (error) {
    console.error('Error getting global USDT address:', error);
    return "";
  }
};

module.exports = {
  isTrc20Address,
  handleTrc20Address,
  getGlobalUsdtAddress
}; 