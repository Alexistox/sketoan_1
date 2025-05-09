const User = require('../models/User');
const Group = require('../models/Group');
const Config = require('../models/Config');
const { isTrc20Address } = require('../utils/formatter');
const { migrateUserGroupsToOperators } = require('../utils/dataConverter');
const { isUserOwner, isUserAdmin, isUserOperator, extractUserFromCommand } = require('../utils/permissions');
const Transaction = require('../models/Transaction');

/**
 * Xử lý lệnh thêm admin (/ad) - Chỉ Owner
 */
const handleAddAdminCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Chỉ Owner mới có quyền thêm Admin
    if (!await isUserOwner(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能添加管理员！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/ad ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /ad @username1 @username2 @username3");
      return;
    }
    
    // Tách các username
    const usernames = parts[1].trim().split(' ').filter(u => u.startsWith('@'));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "/ad || 添加管理员。例如: /ad @username1 @username2");
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let message = '';

    // Xử lý từng username
    for (const username of usernames) {
      const targetUser = await extractUserFromCommand(username);
      if (!targetUser) {
        failCount++;
        continue;
      }
      
      // Kiểm tra nếu đã là admin
      if (targetUser.isAdmin) {
        message += `⚠️ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 已经是管理员了。\n`;
        failCount++;
        continue;
      }
      
      // Cập nhật quyền Admin
      targetUser.isAdmin = true;
      await targetUser.save();
      message += `✅ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 已被设置为管理员\n`;
      successCount++;
    }

    // Thêm thống kê vào cuối tin nhắn
    message += `\n📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`;
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleAddAdminCommand:', error);
    bot.sendMessage(msg.chat.id, "处理添加管理员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa admin (/removead) - Chỉ Owner
 */
const handleRemoveAdminCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Chỉ Owner mới có quyền xóa Admin
    if (!await isUserOwner(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能移除管理员！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/removead ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /removead @username1 @username2 @username3");
      return;
    }
    
    // Tách các username
    const usernames = parts[1].trim().split(' ').filter(u => u.startsWith('@'));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "/removead || 删除管理员。例如: /removead @username1 @username2");
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let message = '';

    // Xử lý từng username
    for (const username of usernames) {
      const targetUser = await extractUserFromCommand(username);
      if (!targetUser) {
        failCount++;
        continue;
      }
      
      // Kiểm tra nếu là owner
      if (targetUser.isOwner) {
        message += `⛔ 不能移除机器人所有者的管理员权限！\n`;
        failCount++;
        continue;
      }
      
      // Kiểm tra nếu không phải admin
      if (!targetUser.isAdmin) {
        message += `⚠️ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 不是管理员。\n`;
        failCount++;
        continue;
      }
      
      // Cập nhật quyền Admin
      targetUser.isAdmin = false;
      await targetUser.save();
      message += `✅ 已移除用户 @${targetUser.username} (ID: ${targetUser.userId}) 的管理员权限\n`;
      successCount++;
    }

    // Thêm thống kê vào cuối tin nhắn
    message += `\n📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`;
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleRemoveAdminCommand:', error);
    bot.sendMessage(msg.chat.id, "处理移除管理员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh liệt kê tất cả admin (/admins) - Chỉ Owner
 */
const handleListAdminsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Chỉ Owner mới có quyền xem danh sách Admin
    if (!await isUserOwner(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者才能查看管理员列表！");
      return;
    }
    
    // Tìm tất cả admin và owner
    const admins = await User.find({ 
      $or: [{ isAdmin: true }, { isOwner: true }]
    }).sort({ isOwner: -1 }); // Owner hiển thị trước
    
    if (admins.length === 0) {
      bot.sendMessage(chatId, "⚠️ 尚未设置任何管理员或所有者。");
      return;
    }
    
    // Tạo danh sách hiển thị
    let message = '👑 管理员列表:\n\n';
    
    admins.forEach(admin => {
      const role = admin.isOwner ? '👑 所有者' : '🔰 管理员';
      message += `${role}: @${admin.username} (ID: ${admin.userId})\n`;
    });
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleListAdminsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理查看管理员列表命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thêm operator (/op) - Admin và Owner
 */
const handleAddOperatorInGroupCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const senderName = msg.from.username || msg.from.first_name || 'unknown';
    const messageText = msg.text;
    
    // Chỉ Admin và Owner có quyền thêm Operator
    if (!await isUserAdmin(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能添加操作员！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/op ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /op @username1 @username2 @username3");
      return;
    }
    
    // Tách các username
    const usernames = parts[1].trim().split(' ').filter(u => u.startsWith('@'));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "/op || 设置操作。例如: /op @username1 @username2");
      return;
    }

    // Tìm hoặc tạo nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      group = new Group({
        chatId: chatId.toString(),
        operators: []
      });
    }

    let successCount = 0;
    let failCount = 0;
    let message = '';

    // Xử lý từng username
    for (const username of usernames) {
      const targetUser = await extractUserFromCommand(username);
      if (!targetUser) {
        failCount++;
        continue;
      }
      
      // Kiểm tra xem đã là operator chưa
      const existingOperator = group.operators.find(op => op.userId === targetUser.userId);
      if (existingOperator) {
        message += `⚠️ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 已经是此群组的操作员。\n`;
        failCount++;
        continue;
      }
      
      // Thêm vào danh sách operators
      group.operators.push({
        userId: targetUser.userId,
        username: targetUser.username,
        dateAdded: new Date()
      });
      
      // Cập nhật groupPermissions trong User document
      const groupPerm = targetUser.groupPermissions.find(p => p.chatId === chatId.toString());
      if (groupPerm) {
        groupPerm.isOperator = true;
      } else {
        targetUser.groupPermissions.push({
          chatId: chatId.toString(),
          isOperator: true
        });
      }
      
      await targetUser.save();
      message += `✅ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 已被添加为此群组的操作员\n`;
      successCount++;
    }

    // Lưu thay đổi vào group
    await group.save();

    // Thêm thống kê vào cuối tin nhắn
    message += `\n📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`;
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleAddOperatorInGroupCommand:', error);
    bot.sendMessage(msg.chat.id, "处理添加操作员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa operator (/removeop) - Admin và Owner
 */
const handleRemoveOperatorInGroupCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Chỉ Admin và Owner có quyền xóa Operator
    if (!await isUserAdmin(userId)) {
      bot.sendMessage(chatId, "⛔ 只有机器人所有者和管理员才能移除操作员！");
      return;
    }
    
    // Phân tích tin nhắn
    const parts = messageText.split('/removeop ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "语法无效。例如: /removeop @username1 @username2 @username3");
      return;
    }
    
    // Tách các username
    const usernames = parts[1].trim().split(' ').filter(u => u.startsWith('@'));
    if (usernames.length === 0) {
      bot.sendMessage(chatId, "用 /removeop || 删除操作。例如: /removeop @username1 @username2");
      return;
    }

    // Tìm thông tin nhóm
    let group = await Group.findOne({ chatId: chatId.toString() });
    if (!group || !group.operators || group.operators.length === 0) {
      bot.sendMessage(chatId, `⚠️ 此群组尚未设置任何操作员。`);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let message = '';

    // Xử lý từng username
    for (const username of usernames) {
      const targetUser = await extractUserFromCommand(username);
      if (!targetUser) {
        failCount++;
        continue;
      }
      
      // Kiểm tra xem có trong danh sách không
      const operatorIndex = group.operators.findIndex(op => op.userId === targetUser.userId);
      if (operatorIndex === -1) {
        message += `⚠️ 用户 @${targetUser.username} (ID: ${targetUser.userId}) 不是此群组的操作员。\n`;
        failCount++;
        continue;
      }
      
      // Kiểm tra nếu là owner/admin
      if (targetUser.isOwner || targetUser.isAdmin) {
        message += `⛔ 不能移除所有者或管理员的操作员权限！\n`;
        failCount++;
        continue;
      }
      
      // Xóa khỏi danh sách operators
      group.operators.splice(operatorIndex, 1);
      
      // Cập nhật groupPermissions trong User document
      const groupPermIndex = targetUser.groupPermissions.findIndex(p => p.chatId === chatId.toString());
      if (groupPermIndex !== -1) {
        targetUser.groupPermissions.splice(groupPermIndex, 1);
        await targetUser.save();
      }
      
      message += `✅ 已移除用户 @${targetUser.username} (ID: ${targetUser.userId}) 的操作员权限\n`;
      successCount++;
    }

    // Lưu thay đổi vào group
    await group.save();

    // Thêm thống kê vào cuối tin nhắn
    message += `\n📊 统计: 成功 ${successCount} 个, 失败 ${failCount} 个`;
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleRemoveOperatorInGroupCommand:', error);
    bot.sendMessage(msg.chat.id, "处理移除操作员命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh liệt kê operators (/ops) - Tất cả
 */
const handleListOperatorsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    
    // Tìm thông tin nhóm
    const group = await Group.findOne({ chatId: chatId.toString() });
    
    if (!group || !group.operators || group.operators.length === 0) {
      bot.sendMessage(chatId, `⚠️ 此群组尚未设置任何操作员。`);
      return;
    }
    
    // Sắp xếp theo thời gian thêm vào, mới nhất lên đầu
    const sortedOperators = [...group.operators].sort((a, b) => 
      new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0)
    );
    
    // Tạo danh sách hiển thị
    let message = '👥 此群组的操作员列表:\n\n';
    
    for (const op of sortedOperators) {
      const user = await User.findOne({ userId: op.userId });
      let roleBadge = '';
      
      if (user) {
        if (user.isOwner) {
          roleBadge = '👑';
        } else if (user.isAdmin) {
          roleBadge = '🔰';
        } else {
          roleBadge = '🔹';
        }
      } else {
        roleBadge = '🔹';
      }
      
      message += `${roleBadge} @${op.username} (ID: ${op.userId})\n`;
    }
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error in handleListOperatorsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理查看操作员列表命令时出错。请稍后再试。");
  }
};


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
    
    const responseMsg = "💰 *USDT-TRC20地址* 💰\n\n" +
                       "`" + config.value + "`\n\n" +
                       "💵 交易前请向多人确认！ 💱";

    bot.sendMessage(chatId, responseMsg, { parse_mode: 'Markdown' });
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
 * Xử lý lệnh hiển thị danh sách nhóm
 */
const handleListGroupsCommand = async (bot, msg) => {
  try {
    const userId = msg.from.id;
    
    // Chỉ cho phép owner hoặc admin sử dụng lệnh này
    if (!(await isUserAdmin(userId))) {
      bot.sendMessage(msg.chat.id, "⛔ 只有机器人所有者和管理员才能使用此命令！");
      return;
    }
    
    // Lấy tất cả các nhóm từ database
    const groups = await Group.find({});
    
    if (groups.length === 0) {
      bot.sendMessage(msg.chat.id, "机器人还没有加入任何群组。");
      return;
    }
    
    // Format danh sách nhóm
    let message = "*🔄 机器人加入的群组列表:*\n\n";
    
    for (const group of groups) {
      // Lấy thông tin tên nhóm nếu có
      let groupTitle = "未知群组";
      try {
        const chatInfo = await bot.getChat(group.chatId);
        groupTitle = chatInfo.title || `Chat ID: ${group.chatId}`;
      } catch (error) {
        // Không lấy được thông tin chat, có thể bot đã bị đá khỏi nhóm
        groupTitle = `未知群组 (ID: ${group.chatId})`;
      }
      
      // Đếm số lượng giao dịch trong nhóm
      const transactionCount = await Transaction.countDocuments({ 
        chatId: group.chatId,
        skipped: { $ne: true }
      });
      
      // Thêm vào message
      message += `*${groupTitle}*\n`;
      message += `Chat ID: \`${group.chatId}\`\n`;
      message += `Rate: ${group.rate}% | Exchange Rate: ${group.exchangeRate}\n`;
      message += `Transactions: ${transactionCount}\n`;
      message += `Last Clear: ${group.lastClearDate ? group.lastClearDate.toLocaleString() : 'Never'}\n\n`;
    }
    
    message += `Total Groups: ${groups.length}`;
    
    // Gửi tin nhắn
    bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error in handleListGroupsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理列出群组命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh thêm nút inline keyboard
 */
const handleAddInlineCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Kiểm tra quyền Operator
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      return;
    }
    
    // Phân tích cú pháp tin nhắn
    const parts = messageText.split('/inline ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/inline 按钮文字|命令内容");
      return;
    }
    
    const inputParts = parts[1].split('|');
    if (inputParts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/inline 按钮文字|命令内容");
      return;
    }
    
    const buttonText = inputParts[0].trim();
    const commandText = inputParts[1].trim();
    
    if (!buttonText || !commandText) {
      bot.sendMessage(chatId, "按钮文字和命令内容不能为空。");
      return;
    }
    
    // Tìm hoặc tạo Config cho inline buttons
    let inlineConfig = await Config.findOne({ key: `INLINE_BUTTONS_${chatId}` });
    
    let buttons = [];
    if (inlineConfig) {
      try {
        buttons = JSON.parse(inlineConfig.value);
      } catch (error) {
        buttons = [];
      }
    } else {
      inlineConfig = new Config({
        key: `INLINE_BUTTONS_${chatId}`,
        value: JSON.stringify([])
      });
    }
    
    // Kiểm tra xem nút đã tồn tại chưa
    const existingButtonIndex = buttons.findIndex(b => b.text === buttonText);
    
    if (existingButtonIndex >= 0) {
      // Cập nhật nút hiện có
      buttons[existingButtonIndex] = { text: buttonText, command: commandText };
      bot.sendMessage(chatId, `✅ 已更新现有按钮 "${buttonText}"`);
    } else {
      // Thêm nút mới
      buttons.push({ text: buttonText, command: commandText });
      bot.sendMessage(chatId, `✅ 已添加新按钮 "${buttonText}"`);
    }
    
    // Lưu cấu hình
    inlineConfig.value = JSON.stringify(buttons);
    await inlineConfig.save();
    
    // Hiển thị danh sách các nút hiện tại
    await displayInlineButtons(bot, chatId);
    
  } catch (error) {
    console.error('Error in handleAddInlineCommand:', error);
    bot.sendMessage(msg.chat.id, "处理添加按钮命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh xóa nút inline keyboard
 */
const handleRemoveInlineCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    
    // Kiểm tra quyền Operator
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      return;
    }
    
    // Phân tích cú pháp tin nhắn
    const parts = messageText.split('/removeinline ');
    if (parts.length !== 2) {
      bot.sendMessage(chatId, "指令无效。格式为：/removeinline 按钮文字");
      return;
    }
    
    const buttonText = parts[1].trim();
    
    if (!buttonText) {
      bot.sendMessage(chatId, "按钮文字不能为空。");
      return;
    }
    
    // Tìm cấu hình inline buttons
    const inlineConfig = await Config.findOne({ key: `INLINE_BUTTONS_${chatId}` });
    
    if (!inlineConfig) {
      bot.sendMessage(chatId, "还没有设置任何按钮。");
      return;
    }
    
    let buttons = [];
    try {
      buttons = JSON.parse(inlineConfig.value);
    } catch (error) {
      bot.sendMessage(chatId, "按钮配置无效。");
      return;
    }
    
    // Tìm và xóa nút
    const initialLength = buttons.length;
    buttons = buttons.filter(b => b.text !== buttonText);
    
    if (buttons.length < initialLength) {
      // Lưu cấu hình mới
      inlineConfig.value = JSON.stringify(buttons);
      await inlineConfig.save();
      bot.sendMessage(chatId, `✅ 已删除按钮 "${buttonText}"`);
    } else {
      bot.sendMessage(chatId, `❌ 未找到按钮 "${buttonText}"`);
    }
    
    // Hiển thị danh sách các nút hiện tại
    await displayInlineButtons(bot, chatId);
    
  } catch (error) {
    console.error('Error in handleRemoveInlineCommand:', error);
    bot.sendMessage(msg.chat.id, "处理删除按钮命令时出错。请稍后再试。");
  }
};

/**
 * Hiển thị danh sách các nút inline hiện tại
 */
const displayInlineButtons = async (bot, chatId) => {
  try {
    // Tìm cấu hình inline buttons
    const inlineConfig = await Config.findOne({ key: `INLINE_BUTTONS_${chatId}` });
    
    if (!inlineConfig) {
      bot.sendMessage(chatId, "还没有设置任何按钮。");
      return;
    }
    
    let buttons = [];
    try {
      buttons = JSON.parse(inlineConfig.value);
    } catch (error) {
      bot.sendMessage(chatId, "按钮配置无效。");
      return;
    }
    
    if (buttons.length === 0) {
      bot.sendMessage(chatId, "还没有设置任何按钮。");
      return;
    }
    
    // Hiển thị danh sách nút
    let message = "*当前按钮列表:*\n\n";
    
    buttons.forEach((button, index) => {
      message += `${index + 1}. 文字: *${button.text}*\n`;
      message += `   命令: \`${button.command}\`\n\n`;
    });
    
    // Tạo keyboard inline
    const inlineKeyboard = {
      inline_keyboard: buttons.map(button => [
        { text: button.text, callback_data: button.command }
      ])
    };
    
    // Gửi tin nhắn với keyboard
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: inlineKeyboard
    });
    
  } catch (error) {
    console.error('Error in displayInlineButtons:', error);
    bot.sendMessage(chatId, "显示按钮列表时出错。请稍后再试。");
  }
};

/**
 * Xử lý callback từ nút inline
 */
const handleInlineButtonCallback = async (bot, callbackQuery) => {
  try {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id;
    const command = callbackQuery.data;
    
    // Acknowledge the callback query to remove the loading indicator
    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Kiểm tra quyền người dùng
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此功能！需要操作员权限。");
      return;
    }
    
    // Tạo một tin nhắn mới với nội dung của nút
    const msg = {
      chat: { id: chatId },
      from: callbackQuery.from,
      text: command,
      message_id: callbackQuery.message.message_id
    };
    
    // Gửi tin nhắn đến hàm xử lý tin nhắn
    // Đây là một kỹ thuật để tái sử dụng logic xử lý lệnh
    const { handleMessage } = require('./messageController');
    await handleMessage(bot, msg);
    
  } catch (error) {
    console.error('Error in handleInlineButtonCallback:', error);
  }
};

/**
 * Xử lý lệnh bật hiển thị buttons (/onbut)
 */
const handleEnableButtonsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Kiểm tra quyền Operator
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      return;
    }
    
    // Tìm hoặc tạo Config cho trạng thái buttons
    let buttonsConfig = await Config.findOne({ key: `SHOW_BUTTONS_${chatId}` });
    
    if (!buttonsConfig) {
      buttonsConfig = new Config({
        key: `SHOW_BUTTONS_${chatId}`,
        value: 'true'
      });
    } else {
      buttonsConfig.value = 'true';
    }
    
    await buttonsConfig.save();
    bot.sendMessage(chatId, "✅ 已启用所有消息的按钮显示");
    
  } catch (error) {
    console.error('Error in handleEnableButtonsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理命令时出错。请稍后再试。");
  }
};

/**
 * Xử lý lệnh tắt hiển thị buttons (/offbut)
 */
const handleDisableButtonsCommand = async (bot, msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Kiểm tra quyền Operator
    if (!(await isUserOperator(userId, chatId))) {
      bot.sendMessage(chatId, "⛔ 您无权使用此命令！需要操作员权限。");
      return;
    }
    
    // Tìm hoặc tạo Config cho trạng thái buttons
    let buttonsConfig = await Config.findOne({ key: `SHOW_BUTTONS_${chatId}` });
    
    if (!buttonsConfig) {
      buttonsConfig = new Config({
        key: `SHOW_BUTTONS_${chatId}`,
        value: 'false'
      });
    } else {
      buttonsConfig.value = 'false';
    }
    
    await buttonsConfig.save();
    bot.sendMessage(chatId, "✅ 已禁用所有消息的按钮显示");
    
  } catch (error) {
    console.error('Error in handleDisableButtonsCommand:', error);
    bot.sendMessage(msg.chat.id, "处理命令时出错。请稍后再试。");
  }
};

/**
 * Lấy trạng thái hiển thị buttons
 */
const getButtonsStatus = async (chatId) => {
  try {
    const buttonsConfig = await Config.findOne({ key: `SHOW_BUTTONS_${chatId}` });
    return buttonsConfig ? buttonsConfig.value === 'true' : true; // Mặc định là true
  } catch (error) {
    console.error('Error in getButtonsStatus:', error);
    return true;
  }
};

/**
 * Lấy inline keyboard từ cấu hình
 */
const getInlineKeyboard = async (chatId) => {
  try {
    const inlineConfig = await Config.findOne({ key: `INLINE_BUTTONS_${chatId}` });
    if (!inlineConfig) return null;
    
    let buttons = [];
    try {
      buttons = JSON.parse(inlineConfig.value);
    } catch (error) {
      return null;
    }
    
    if (buttons.length === 0) return null;
    
    // Sắp xếp các buttons theo hàng ngang, mỗi hàng tối đa 3 buttons
    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 3) {
      const row = buttons.slice(i, i + 3).map(button => ({
        text: button.text,
        callback_data: button.command
      }));
      keyboard.push(row);
    }
    
    return {
      inline_keyboard: keyboard
    };
  } catch (error) {
    console.error('Error in getInlineKeyboard:', error);
    return null;
  }
};

module.exports = {
  handleListUsersCommand,
  handleCurrencyUnitCommand,
  handleSetUsdtAddressCommand,
  handleGetUsdtAddressCommand,
  handleSetOwnerCommand,
  handleMigrateDataCommand,
  handleAddAdminCommand,
  handleRemoveAdminCommand,
  handleListAdminsCommand,
  handleAddOperatorInGroupCommand,
  handleRemoveOperatorInGroupCommand,
  handleListOperatorsCommand,
  handleListGroupsCommand,
  handleAddInlineCommand,
  handleRemoveInlineCommand,
  handleInlineButtonCallback,
  displayInlineButtons,
  handleEnableButtonsCommand,
  handleDisableButtonsCommand,
  getButtonsStatus,
  getInlineKeyboard
}; 