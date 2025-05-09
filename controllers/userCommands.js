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
      bot.sendMessage(chatId, "指令无效。格式为：移除操作人 @username 或 移除操作人 ID");
      return;
    }
    
    // Lấy phần sau lệnh - username hoặc ID
    const input = messageText.substring(cmdIndex + 4).trim();
    const username = input.replace('@', '');
    
    if (!input) {
      bot.sendMessage(chatId, "请指定一个用户名或ID。");
      return;
    }
    
    // Tìm thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.operators || group.operators.length === 0) {
      bot.sendMessage(chatId, `⚠️ 此群组尚未设置任何操作人。使用 /users 命令查看可用操作人列表。`);
      return;
    }
    
    // Kiểm tra xem input có phải là userid không
    let operatorIndex = -1;
    
    // Thử tìm theo userID
    operatorIndex = group.operators.findIndex(op => op.userId === input);
    
    // Nếu không tìm thấy theo userID, thử tìm theo username (không phân biệt hoa thường)
    if (operatorIndex === -1) {
      operatorIndex = group.operators.findIndex(op => op.username.toLowerCase() === username.toLowerCase());
    }
    
    if (operatorIndex === -1) {
      bot.sendMessage(chatId, `⚠️ 未找到用户 "${input}"。使用 /users 命令查看可用操作人列表和ID。`);
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
    bot.sendMessage(chatId, `✅ 已从此群组的操作人列表中移除用户 @${operator.username} (ID: ${operator.userId})。`);
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
      ownersList = '🔑 所有者列表:\n' + owners.map(o => `@${o.username}: ${o.userId}`).join('\n');
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
      
      operatorsList = '👥 此群组的操作人列表:\n' + sortedOperators.map(op => `@${op.username}: ${op.userId}`).join('\n');
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
 * Xử lý lệnh xóa người điều hành theo tên người dùng hoặc ID (/remove)
 */
const handleRemoveCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const messageText = msg.text;
    
    // Phân tích tin nhắn để lấy username hoặc ID
    const parts = messageText.split('/remove ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "⚠️ 指令无效。格式为：/remove @username 或 /remove ID");
      return;
    }
    
    // Lấy username hoặc ID
    const input = parts[1].trim();
    const username = input.replace('@', '');
    
    if (!input) {
      bot.sendMessage(chatId, "⚠️ 请指定一个用户名或ID。");
      return;
    }
    
    // Tìm thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.operators || group.operators.length === 0) {
      bot.sendMessage(chatId, `⚠️ 此群组尚未设置任何操作人。使用 /users 命令查看可用操作人列表。`);
      return;
    }
    
    // Kiểm tra xem input có phải là userid không
    let operatorIndex = -1;
    
    // Thử tìm theo userID
    operatorIndex = group.operators.findIndex(op => op.userId === input);
    
    // Nếu không tìm thấy theo userID, thử tìm theo username (không phân biệt hoa thường)
    if (operatorIndex === -1) {
      operatorIndex = group.operators.findIndex(op => op.username.toLowerCase() === username.toLowerCase());
    }
    
    if (operatorIndex === -1) {
      bot.sendMessage(chatId, `⚠️ 未找到用户 "${input}"。使用 /users 命令查看可用操作人列表和ID。`);
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
    bot.sendMessage(chatId, `✅ 已从此群组的操作人列表中移除用户 @${operator.username} (ID: ${operator.userId})。`);
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

/**
 * Xử lý lệnh liệt kê admins (/admins)
 */
const handleListAdminsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Tìm tất cả admin và owner
    const admins = await User.find({ $or: [{ isAdmin: true }, { isOwner: true }] });
    
    if (!admins || admins.length === 0) {
      bot.sendMessage(chatId, "⚠️ 系统中尚未有管理员。");
      return;
    }
    
    let message = "👮 *系统管理员列表*\n\n";
    
    // Hiển thị owners trước
    const owners = admins.filter(user => user.isOwner);
    if (owners.length > 0) {
      message += "👑 *所有者:*\n";
      owners.forEach((owner, index) => {
        message += `${index + 1}. @${owner.username}: ${owner.userId}\n`;
      });
      message += "\n";
    }
    
    // Hiển thị admins không phải owner
    const normalAdmins = admins.filter(user => !user.isOwner && user.isAdmin);
    if (normalAdmins.length > 0) {
      message += "👮 *管理员:*\n";
      normalAdmins.forEach((admin, index) => {
        message += `${index + 1}. @${admin.username}: ${admin.userId}\n`;
      });
    }
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in handleListAdminsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理列出管理员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa admin (/removeadmin)
 */
const handleRemoveAdminCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Chỉ Owner mới có quyền xóa Admin
    if (!await isUserOwner(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能移除管理员");
      return;
    }
    
    // Phân tích username hoặc ID người dùng
    const parts = messageText.split('/removeadmin ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /removeadmin @username 或 /removeadmin 123456789");
      return;
    }
    
    const input = parts[1].trim();
    const username = input.replace('@', '');
    
    if (!input) {
      bot.sendMessage(chatId, "请指定一个用户名或ID。");
      return;
    }
    
    // Tìm user theo username hoặc userId
    let user;
    if (input === username) {
      // Tìm theo username
      user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    } else {
      // Tìm theo userId
      user = await User.findOne({ userId: input });
    }
    
    if (!user) {
      bot.sendMessage(chatId, "未找到用户。请确保用户名或ID正确。");
      return;
    }
    
    // Không thể xóa admin là owner
    if (user.isOwner) {
      bot.sendMessage(chatId, "⛔ 不能移除机器人所有者！");
      return;
    }
    
    // Cập nhật quyền Admin
    user.isAdmin = false;
    await user.save();
    
    bot.sendMessage(chatId, `✅ 用户 @${user.username} (ID: ${user.userId}) 已被移除管理员权限`);
  } catch (error) {
    console.error('Error in handleRemoveAdminCommand:', error);
    bot.sendMessage(msg.chat.id, "处理移除管理员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thêm admin (/addadmin)
 */
const handleAddAdminCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Chỉ Owner mới có quyền thêm Admin
    if (!await isUserOwner(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能添加管理员");
      return;
    }
    
    // Phân tích username hoặc ID người dùng
    const parts = messageText.split('/addadmin ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /addadmin @username 或 /addadmin 123456789");
      return;
    }
    
    const input = parts[1].trim();
    const username = input.replace('@', '');
    
    if (!input) {
      bot.sendMessage(chatId, "请指定一个用户名或ID。");
      return;
    }
    
    // Tìm user theo username hoặc userId
    let user;
    if (input === username) {
      // Tìm theo username
      user = await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
    } else {
      // Tìm theo userId
      user = await User.findOne({ userId: input });
    }
    
    if (!user) {
      // Tạo user mới nếu chưa tồn tại
      const uniqueUserId = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      user = new User({
        userId: uniqueUserId,
        username: username,
        isAdmin: true
      });
      
      await user.save();
      bot.sendMessage(chatId, `✅ 已创建并添加新用户 @${username} 为管理员`);
      return;
    }
    
    // Kiểm tra nếu đã là admin
    if (user.isAdmin) {
      bot.sendMessage(chatId, `⚠️ 用户 @${user.username} 已经是管理员。`);
      return;
    }
    
    // Cập nhật quyền Admin
    user.isAdmin = true;
    await user.save();
    
    bot.sendMessage(chatId, `✅ 用户 @${user.username} (ID: ${user.userId}) 已被设置为管理员`);
  } catch (error) {
    console.error('Error in handleAddAdminCommand:', error);
    bot.sendMessage(msg.chat.id, "处理添加管理员命令时出错。请稍后再试。");
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
  handleMigrateDataCommand,
  handleListAdminsCommand,
  handleRemoveAdminCommand,
  handleAddAdminCommand
}; 