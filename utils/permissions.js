const User = require('../models/User');
const Group = require('../models/Group');

/**
 * Kiểm tra quyền hạn owner
 * @param {string} userId - ID người dùng cần kiểm tra
 * @returns {Promise<boolean>} - true nếu là owner, false nếu không phải
 */
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
 * Kiểm tra quyền hạn admin
 * @param {string} userId - ID người dùng cần kiểm tra
 * @returns {Promise<boolean>} - true nếu là admin hoặc owner, false nếu không phải
 */
const isUserAdmin = async (userId) => {
  try {
    const user = await User.findOne({ userId: userId.toString() });
    return (user && user.isAdmin) || (user && user.isOwner);
  } catch (error) {
    console.error('Error in isUserAdmin:', error);
    return false;
  }
};

/**
 * Kiểm tra quyền hạn operator trong nhóm cụ thể
 * @param {string} userId - ID người dùng cần kiểm tra
 * @param {string} chatId - ID của chat/nhóm
 * @returns {Promise<boolean>} - true nếu là operator, admin hoặc owner, false nếu không phải
 */
const isUserOperator = async (userId, chatId) => {
  try {
    // Owner và Admin có toàn quyền
    if (await isUserAdmin(userId)) {
      return true;
    }

    // Kiểm tra trong danh sách operator của nhóm
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (group && group.operators) {
      return group.operators.some(op => op.userId === userId.toString());
    }

    return false;
  } catch (error) {
    console.error('Error in isUserOperator:', error);
    return false;
  }
};

/**
 * Trích xuất thông tin người dùng từ một chuỗi đầu vào
 * Hỗ trợ cả username (với hoặc không có @) và ID người dùng
 * Nếu người dùng không tồn tại, tự động tạo mới
 * @param {string} input - Username hoặc ID người dùng
 * @param {boolean} [createIfNotFound=true] - Tự động tạo người dùng mới nếu không tìm thấy
 * @returns {Promise<Object|null>} - Thông tin người dùng hoặc null nếu không thể tạo
 */
const extractUserFromCommand = async (input, createIfNotFound = true) => {
  try {
    let username = input.trim();
    
    // Xóa ký tự @ nếu có
    if (username.startsWith('@')) {
      username = username.substring(1);
    }
    
    // Nếu không có input, không tìm kiếm
    if (!username) {
      return null;
    }
    
    let user;
    
    // Thử tìm theo userId
    user = await User.findOne({ userId: username });
    
    // Nếu không tìm thấy, thử tìm theo username (không phân biệt hoa thường)
    if (!user) {
      user = await User.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') }
      });
    }
    
    // Nếu không tìm thấy và createIfNotFound=true, tạo người dùng mới
    if (!user && createIfNotFound) {
      // Tạo một ID người dùng duy nhất nếu không phải là số
      const isNumericId = /^\d+$/.test(username);
      const userId = isNumericId ? username : `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      
      user = await createOrUpdateUser({
        userId,
        username,
        firstName: '',
        lastName: ''
      });
      
      console.log(`Created new user: ${username} with ID: ${userId}`);
    }
    
    return user;
  } catch (error) {
    console.error('Error in extractUserFromCommand:', error);
    return null;
  }
};

/**
 * Tạo mới hoặc cập nhật người dùng
 * @param {Object} userData - Dữ liệu người dùng
 * @param {string} userData.userId - ID người dùng
 * @param {string} userData.username - Tên người dùng
 * @param {string} [userData.firstName=''] - Tên đầu tiên
 * @param {string} [userData.lastName=''] - Tên cuối 
 * @param {boolean} [userData.isAdmin=false] - Có phải admin không
 * @param {boolean} [userData.isOwner=false] - Có phải owner không
 * @returns {Promise<Object>} - Thông tin người dùng
 */
const createOrUpdateUser = async (userData) => {
  try {
    const { userId, username, firstName = '', lastName = '', isAdmin = false, isOwner = false } = userData;
    
    // Tìm người dùng theo ID
    let user = await User.findOne({ userId: userId.toString() });
    
    if (user) {
      // Cập nhật thông tin người dùng nếu đã tồn tại, nhưng giữ nguyên trạng thái quyền
      user.username = username || user.username;
      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      
      // Chỉ cập nhật quyền nếu được chỉ định
      if (isAdmin && !user.isAdmin) user.isAdmin = true;
      if (isOwner && !user.isOwner) user.isOwner = true;
      
      await user.save();
    } else {
      // Tạo người dùng mới nếu chưa tồn tại
      user = new User({
        userId: userId.toString(),
        username,
        firstName,
        lastName,
        isAdmin,
        isOwner,
        groupPermissions: []
      });
      
      await user.save();
    }
    
    return user;
  } catch (error) {
    console.error('Error in createOrUpdateUser:', error);
    return null;
  }
};

module.exports = {
  isUserOwner,
  isUserAdmin,
  isUserOperator,
  extractUserFromCommand,
  createOrUpdateUser
}; 