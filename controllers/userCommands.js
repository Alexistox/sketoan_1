const User = require('../models/User');
const Config = require('../models/Config');
const { isTrc20Address } = require('../utils/formatter');

// Helper function to check if user is owner (copied from messageController to avoid circular dependencies)
const isUserOwner = async (userId) => {
  try {
    const user = await User.findOne({ userId: userId.toString() });
    return user && user.isOwner;
  } catch (error) {
    console.error('Error in isUserOwner:', error);
    return false;
  }
};

/**
 * Xử lý lệnh thêm người điều hành (加操作人)
 */
const handleAddOperatorCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn bằng cách tìm index của '加操作人' và lấy tất cả ký tự sau đó
    const cmdIndex = messageText.indexOf('加操作人');
    if (cmdIndex === -1) {
      bot.sendMessage(chatId, "指令无效。格式为：加操作人 @username");
      return;
    }
    
    // Lấy phần sau lệnh
    const usernameText = messageText.substring(cmdIndex + 4).trim();
    const username = usernameText.replace('@', '');
    
    if (!username) {
      bot.sendMessage(chatId, "请指定一个用户名。");
      return;
    }
    
    // Tìm người dùng theo username
    let user = await User.findOne({ username });
    
    if (!user) {
      // Tạo người dùng mới nếu không tồn tại
      // Tạo một ID người dùng duy nhất sử dụng timestamp
      const uniqueUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      user = new User({
        userId: uniqueUserId, // Thêm userId cho user mới
        username,
        isAllowed: false,
        allowedGroups: [chatId.toString()]
      });
      await user.save();
      bot.sendMessage(chatId, `✅ 已添加新用户 @${username} 到此群组的操作人列表。`);
    } else if (user.allowedGroups && user.allowedGroups.includes(chatId.toString())) {
      bot.sendMessage(chatId, `⚠️ 用户 @${username} 已在此群组的操作人列表中。`);
    } else {
      // Add this group to the user's allowed groups
      if (!user.allowedGroups) {
        user.allowedGroups = [chatId.toString()];
      } else {
        user.allowedGroups.push(chatId.toString());
      }
      await user.save();
      bot.sendMessage(chatId, `✅ 已添加用户 @${username} 到此群组的操作人列表。`);
    }
  } catch (error) {
    console.error('Error in handleAddOperatorCommand:', error);
    bot.sendMessage(msg.chat.id, "处理添加操作人命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa người điều hành (移除操作人)
 */
const handleRemoveOperatorCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn bằng cách tìm index của '移除操作人' và lấy tất cả ký tự sau đó
    const cmdIndex = messageText.indexOf('移除操作人');
    if (cmdIndex === -1) {
      bot.sendMessage(chatId, "指令无效。格式为：移除操作人 @username");
      return;
    }
    
    // Lấy phần sau lệnh
    const usernameText = messageText.substring(cmdIndex + 4).trim();
    const username = usernameText.replace('@', '');
    
    if (!username) {
      bot.sendMessage(chatId, "请指定一个用户名。");
      return;
    }
    
    // Tìm người dùng theo username - case insensitive search
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    });
    
    if (!user) {
      bot.sendMessage(chatId, `⚠️ 未找到用户 @${username}。使用 /users 命令查看可用用户列表。`);
      return;
    }
    
    if (user.isOwner) {
      bot.sendMessage(chatId, `⛔ 不能移除机器人所有者！`);
      return;
    }
    
    const isInGlobalList = user.isAllowed;
    const isInGroupList = user.allowedGroups && user.allowedGroups.includes(chatId.toString());
    
    if (!isInGlobalList && !isInGroupList) {
      bot.sendMessage(chatId, `⚠️ 用户 @${username} 不在此群组的操作人列表中。`);
      return;
    }
    
    // If user has global permissions (legacy), we need to check if they should be removed
    if (isInGlobalList) {
      // We'll convert the global permission to group-specific permissions for all groups except this one
      user.isAllowed = false;
      
      // First get all groups where this user might be active from their allowedGroups
      const currentGroups = [...(user.allowedGroups || [])];
      
      // Filter out the current group
      user.allowedGroups = currentGroups.filter(g => g !== chatId.toString());
    } else {
      // Just remove this specific group
      user.allowedGroups = user.allowedGroups.filter(g => g !== chatId.toString());
    }
    
    await user.save();
    bot.sendMessage(chatId, `✅ 已从此群组的操作人列表中移除用户 @${username}。`);
  } catch (error) {
    console.error('Error in handleRemoveOperatorCommand:', error);
    bot.sendMessage(msg.chat.id, "处理移除操作人命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh liệt kê người dùng (/users)
 */
const handleListUsersCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Tìm tất cả owner
    const owners = await User.find({ isOwner: true });
    let ownersList = '';
    if (owners.length > 0) {
      ownersList = '🔑 所有者列表:\n' + owners.map(o => '@' + o.username).join(', ');
    } else {
      ownersList = '🔑 尚未设置机器人所有者';
    }
    
    // Tìm tất cả người dùng được phép trong nhóm này (nhưng không phải owner)
    const groupOperators = await User.find({
      $and: [
        { isOwner: false },
        { 
          $or: [
            // Global permissions (legacy)
            { isAllowed: true },
            // Group-specific permissions
            { allowedGroups: chatId.toString() }
          ]
        }
      ]
    });
    
    let operatorsList = '';
    if (groupOperators.length > 0) {
      operatorsList = '👥 此群组的操作人列表:\n' + groupOperators.map(u => '@' + u.username).join(', ');
    } else {
      operatorsList = '👥 此群组尚未有操作人';
    }
    
    // Send both lists
    bot.sendMessage(chatId, `${ownersList}\n\n${operatorsList}`);
  } catch (error) {
    console.error('Error in handleListUsersCommand:', error);
    bot.sendMessage(msg.chat.id, "处理列出用户命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập đơn vị tiền tệ (/m)
 */
const handleCurrencyUnitCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('/m ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/m 币种名称");
      return;
    }
    
    const currencyUnit = parts[1].trim().toUpperCase();
    if (!currencyUnit) {
      bot.sendMessage(chatId, "请指定一个币种名称。");
      return;
    }
    
    // Tìm config đã tồn tại hoặc tạo mới
    let config = await Config.findOne({ key: 'CURRENCY_UNIT' });
    
    if (!config) {
      config = new Config({
        key: 'CURRENCY_UNIT',
        value: currencyUnit
      });
    } else {
      config.value = currencyUnit;
    }
    
    await config.save();
    bot.sendMessage(chatId, `✅ 已设置币种为 ${currencyUnit}`);
  } catch (error) {
    console.error('Error in handleCurrencyUnitCommand:', error);
    bot.sendMessage(msg.chat.id, "处理设置币种命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập địa chỉ USDT (/usdt)
 */
const handleSetUsdtAddressCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn
    const parts = messageText.split('/usdt ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "ℹ️ 语法: /usdt <TRC20地址>");
      return;
    }
    
    const address = parts[1].trim();
    if (!isTrc20Address(address)) {
      bot.sendMessage(chatId, "❌ TRC20地址无效！地址必须以字母T开头并且有34个字符。");
      return;
    }
    
    // Tìm config đã tồn tại hoặc tạo mới
    let config = await Config.findOne({ key: 'USDT_ADDRESS' });
    const oldAddress = config ? config.value : null;
    
    if (!config) {
      config = new Config({
        key: 'USDT_ADDRESS',
        value: address
      });
    } else {
      config.value = address;
    }
    
    await config.save();
    
    if (oldAddress) {
      bot.sendMessage(chatId, "🔄 已更新USDT-TRC20地址:\n`" + address + "`");
    } else {
      bot.sendMessage(chatId, "✅ 已保存全局USDT-TRC20地址:\n`" + address + "`");
    }
  } catch (error) {
    console.error('Error in handleSetUsdtAddressCommand:', error);
    bot.sendMessage(msg.chat.id, "处理设置USDT地址命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh lấy địa chỉ USDT (/u)
 */
const handleGetUsdtAddressCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Tìm địa chỉ USDT
    const config = await Config.findOne({ key: 'USDT_ADDRESS' });
    
    if (!config || !config.value) {
      bot.sendMessage(chatId, "⚠️ 尚未设置USDT-TRC20地址。请使用 /usdt 命令设置。");
      return;
    }
    
    bot.sendMessage(chatId, "💰 USDT-TRC20地址:\n`" + config.value + "`");
  } catch (error) {
    console.error('Error in handleGetUsdtAddressCommand:', error);
    bot.sendMessage(msg.chat.id, "处理获取USDT地址命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thiết lập người sở hữu (/setowner)
 */
const handleSetOwnerCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    const senderId = msg.from.id;
    
    // Chỉ cho phép owner hiện tại thêm owner khác
    const isCurrentUserOwner = await isUserOwner(senderId.toString());
    if (!isCurrentUserOwner) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/setowner ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/setowner @username");
      return;
    }
    
    // Lấy username
    const usernameText = parts[1].trim();
    const username = usernameText.replace('@', '');
    
    if (!username) {
      bot.sendMessage(chatId, "请指定一个用户名。");
      return;
    }
    
    // Tìm người dùng theo username
    let user = await User.findOne({ username });
    
    if (!user) {
      // Tạo người dùng mới nếu không tồn tại
      const uniqueUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      user = new User({
        userId: uniqueUserId,
        username,
        isOwner: true,
        isAllowed: true
      });
      await user.save();
      bot.sendMessage(chatId, `✅ 已将新用户 @${username} 设置为机器人所有者。`);
    } else if (user.isOwner) {
      bot.sendMessage(chatId, `⚠️ 用户 @${username} 已是机器人所有者。`);
    } else {
      user.isOwner = true;
      user.isAllowed = true;
      await user.save();
      bot.sendMessage(chatId, `✅ 已将用户 @${username} 设置为机器人所有者。`);
    }
  } catch (error) {
    console.error('Error in handleSetOwnerCommand:', error);
    bot.sendMessage(msg.chat.id, "处理设置所有者命令时出错。请稍后再试。");
  }
};

const handleRemoveCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn để lấy username
    const parts = messageText.split('/remove ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "⚠️ 指令无效。格式为：/remove @username");
      return;
    }
    
    // Lấy username và loại bỏ ký tự "@" nếu có
    const usernameText = parts[1].trim();
    const username = usernameText.replace('@', '');
    
    if (!username) {
      bot.sendMessage(chatId, "⚠️ 请指定一个用户名。");
      return;
    }
    
    // Tìm người dùng theo username
    const user = await User.findOne({ username });
    
    if (!user) {
      bot.sendMessage(chatId, `⚠️ 未找到用户 @${username}。使用 /users 命令查看可用用户列表。`);
      return;
    }
    
    if (user.isOwner) {
      bot.sendMessage(chatId, `⛔ 不能移除机器人所有者！`);
      return;
    }
    
    const isInGlobalList = user.isAllowed;
    const isInGroupList = user.allowedGroups && user.allowedGroups.includes(chatId.toString());
    
    if (!isInGlobalList && !isInGroupList) {
      bot.sendMessage(chatId, `⚠️ 用户 @${username} 不在此群组的操作人列表中。`);
      return;
    }
    
    // Nếu user có quyền global
    if (isInGlobalList) {
      // Chuyển quyền global thành quyền specific cho các nhóm khác
      user.isAllowed = false;
      
      // Lấy danh sách các nhóm hiện tại
      const currentGroups = [...(user.allowedGroups || [])];
      
      // Loại bỏ nhóm hiện tại khỏi danh sách
      user.allowedGroups = currentGroups.filter(g => g !== chatId.toString());
    } else {
      // Chỉ xóa quyền của nhóm hiện tại
      user.allowedGroups = user.allowedGroups.filter(g => g !== chatId.toString());
    }
    
    await user.save();
    bot.sendMessage(chatId, `✅ 已从此群组的操作人列表中移除用户 @${username}。`);
  } catch (error) {
    console.error('Error in handleRemoveCommand:', error);
    bot.sendMessage(msg.chat.id, "处理移除操作人命令时出错。请稍后再试。");
  }
};

module.exports = {
  handleAddOperatorCommand,
  handleRemoveOperatorCommand,
  handleListUsersCommand,
  handleCurrencyUnitCommand,
  handleSetUsdtAddressCommand,
  handleGetUsdtAddressCommand,
  handleSetOwnerCommand,
  handleRemoveCommand
}; 