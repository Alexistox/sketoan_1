const OpenAI = require('openai');
const moment = require('moment');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const extractBankInfoFromImage = async (photoFileId, chatId, bot) => {
  try {
    // Get file path from Telegram
    const fileInfo = await bot.getFile(photoFileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;

    // Download image and convert to base64
    const response = await fetch(fileUrl);
    const buffer = await response.buffer();
    const base64Image = buffer.toString('base64');
    const base64Url = `data:image/jpeg;base64,${base64Image}`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Trích xuất thông tin tài khoản ngân hàng từ hình ảnh này. Hãy xác định: tên ngân hàng (ngôn ngữ gốc), tên ngân hàng bằng tiếng Anh, số tài khoản, và tên chủ tài khoản. Trả về kết quả dưới dạng JSON với các trường: bankName, bankNameEnglish, accountNumber, accountName. Nếu không tìm thấy thông tin, hãy trả về trường đó là null."
            },
            {
              type: "image_url",
              image_url: {
                url: base64Url
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    const content = completion.choices[0].message.content;
    
    try {
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no JSON found, create object and extract info from text
      const bankInfo = {
        bankName: null,
        bankNameEnglish: null,
        accountNumber: null,
        accountName: null
      };

      // Extract bank name
      const bankMatch = content.match(/(?:ngân hàng|bank)[:\s]+([^\n.,]+)/i);
      if (bankMatch) bankInfo.bankName = bankMatch[1].trim();

      // Extract English bank name
      const bankEnglishMatch = content.match(/(?:tiếng Anh|English)[:\s]+([^\n.,]+)/i);
      if (bankEnglishMatch) bankInfo.bankNameEnglish = bankEnglishMatch[1].trim();

      // Extract account number
      const accountMatch = content.match(/(?:số tài khoản|số tk|account number|account no)[:\s]+([0-9\s-]+)/i);
      if (accountMatch) bankInfo.accountNumber = accountMatch[1].replace(/\s+/g, '').trim();

      // Extract account name
      const nameMatch = content.match(/(?:tên|chủ tài khoản|tên tk|account name|beneficiary)[:\s]+([^\n.,]+)/i);
      if (nameMatch) bankInfo.accountName = nameMatch[1].trim();

      return bankInfo;
    } catch (error) {
      console.error("Error parsing bank info:", error);
      return null;
    }
  } catch (error) {
    console.error("Error processing image:", error);
    return null;
  }
};

const handleBankImage = async (msg, bot) => {
  const chatId = msg.chat.id;
  const photos = msg.photo;
  
  if (!photos || photos.length === 0) {
    await bot.sendMessage(chatId, "❌ 无法获取图片文件信息.");
    return;
  }

  // Get highest resolution photo
  const photoFileId = photos[photos.length - 1].file_id;
  
  // Notify user
  await bot.sendMessage(chatId, "⏳ 正在获取银行账户信息…");
  
  // Extract bank info
  const bankInfo = await extractBankInfoFromImage(photoFileId, chatId, bot);
  
  if (bankInfo) {
    const currentDate = moment().format('DD/MM/YYYY');
    
    // Generate unique code
    const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const uniqueCode = randomLetter + randomNumber;
    
    const formattedMessage = 
      `${uniqueCode} - ${currentDate}\n` +
      `${bankInfo.bankName || "[未找到]"}\n` +
      `${bankInfo.bankNameEnglish || "[未找到]"}\n` +
      `${bankInfo.accountNumber || "[未找到]"}\n` +
      `${bankInfo.accountName || "[未找到]"}`;
    
    await bot.sendMessage(chatId, formattedMessage);
  } else {
    await bot.sendMessage(chatId, "❌ 无法从该图片识别出银行账户信息.");
  }
};

module.exports = {
  handleBankImage
}; 