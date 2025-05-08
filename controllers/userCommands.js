const User = require('../models/User');
const Group = require('../models/Group');
const Config = require('../models/Config');
const { isTrc20Address } = require('../utils/formatter');
const { migrateUserGroupsToOperators } = require('../utils/dataConverter');

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
    
    // Tìm hoặc tạo mới thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({ chatId: chatId.toString() });
    }
    
    // Kiểm tra xem người dùng đã có trong danh sách operators chưa - không phân biệt hoa thường
    const existingOperator = group.operators.find(op => op.username.toLowerCase() === username.toLowerCase());
    if (existingOperator) {
      bot.sendMessage(chatId, `⚠️ 用户 @${existingOperator.username} 已在此群组的操作人列表中。`);
      return;
    }
    
    // Tìm người dùng theo username - không phân biệt hoa thường
    let user = await User.findOne({ 
      username: { $regex: new RegExp(`^${username}$`, 'i') } 
    });
    
    if (!user) {
      // Tạo người dùng mới nếu không tồn tại
      // Tạo một ID người dùng duy nhất sử dụng timestamp
      const uniqueUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      user = new User({
        userId: uniqueUserId,
        username,
        isAllowed: false
      });
      await user.save();
    }
    
    // Thêm người dùng vào danh sách operators của nhóm
    group.operators.push({
      userId: user.userId,
      username: user.username,
      dateAdded: new Date()
    });
    
    await group.save();
    bot.sendMessage(chatId, `✅ 已添加用户 @${user.username} 到此群组的操作人列表。`);
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
    
    // Tìm thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.operators || group.operators.length === 0) {
      bot.sendMessage(chatId, `⚠️ 此群组尚未设置任何操作人。使用 /users 命令查看可用操作人列表。`);
      return;
    }
    
    // Kiểm tra xem người dùng có trong danh sách operators không - không phân biệt hoa thường
    const operatorIndex = group.operators.findIndex(op => op.username.toLowerCase() === username.toLowerCase());
    if (operatorIndex === -1) {
      bot.sendMessage(chatId, `⚠️ 用户 @${username} 不在此群组的操作人列表中。使用 /users 命令查看可用操作人列表。`);
      return;
    }
    
    // Lấy thông tin operator từ danh sách
    const operator = group.operators[operatorIndex];
    
    // Kiểm tra nếu là owner
    const user = await User.findOne({ username: operator.username });
    if (user && user.isOwner) {
      bot.sendMessage(chatId, `⛔ 不能移除机器人所有者！`);
      return;
    }
    
    // Xóa người dùng khỏi danh sách operators
    group.operators.splice(operatorIndex, 1);
    
    await group.save();
    bot.sendMessage(chatId, `✅ 已从此群组的操作人列表中移除用户 @${operator.username}。`);
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
    
    // Tìm thông tin nhóm và danh sách operators
    const group = await Group.findOne({ chatId: chatId.toString() });
    
    let operatorsList = '';
    if (group && group.operators && group.operators.length > 0) {
      // Sắp xếp theo thời gian thêm vào, mới nhất lên đầu
      const sortedOperators = [...group.operators].sort((a, b) => 
        new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0)
      );
      
      operatorsList = '👥 此群组的操作人列表:\n' + sortedOperators.map(op => '@' + op.username).join(', ');
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

/**
 * Xử lý lệnh xóa người điều hành theo tên người dùng (/remove)
 */
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
    
    // Tìm thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.operators || group.operators.length === 0) {
      bot.sendMessage(chatId, `⚠️ 此群组尚未设置任何操作人。使用 /users 命令查看可用操作人列表。`);
      return;
    }
    
    // Kiểm tra xem người dùng có trong danh sách operators không
    const operatorIndex = group.operators.findIndex(op => op.username.toLowerCase() === username.toLowerCase());
    if (operatorIndex === -1) {
      bot.sendMessage(chatId, `⚠️ 用户 @${username} 不在此群组的操作人列表中。使用 /users 命令查看可用操作人列表。`);
      return;
    }
    
    // Lấy thông tin operator từ danh sách
    const operator = group.operators[operatorIndex];
    
    // Kiểm tra nếu là owner
    const user = await User.findOne({ username: operator.username });
    if (user && user.isOwner) {
      bot.sendMessage(chatId, `⛔ 不能移除机器人所有者！`);
      return;
    }
    
    // Xóa người dùng khỏi danh sách operators
    group.operators.splice(operatorIndex, 1);
    
    await group.save();
    bot.sendMessage(chatId, `✅ 已从此群组的操作人列表中移除用户 @${operator.username}。`);
  } catch (error) {
    console.error('Error in handleRemoveCommand:', error);
    bot.sendMessage(msg.chat.id, "处理移除操作人命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh chuyển đổi dữ liệu (/migrate)
 */
const handleMigrateDataCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Chỉ cho phép owner thực hiện việc chuyển đổi dữ liệu
    const isCurrentUserOwner = await isUserOwner(userId.toString());
    if (!isCurrentUserOwner) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能使用此命令！");
      return;
    }
    
    bot.sendMessage(chatId, "🔄 开始数据迁移，请稍后...");
    
    const result = await migrateUserGroupsToOperators();
    
    if (result.success) {
      bot.sendMessage(chatId, "✅ 数据迁移成功！用户权限已从旧结构转移到新结构。");
    } else {
      bot.sendMessage(chatId, `❌ 数据迁移失败: ${result.error}`);
    }
  } catch (error) {
    console.error('Error in handleMigrateDataCommand:', error);
    bot.sendMessage(msg.chat.id, "处理数据迁移命令时出错。请稍后再试。");
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
  handleRemoveCommand,
  handleMigrateDataCommand
}; 