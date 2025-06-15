const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Card = require('../models/Card');
const Config = require('../models/Config');
const { formatSmart, formatTimeString, getGroupNumberFormat } = require('../utils/formatter');

/**
 * Route để hiển thị báo cáo giao dịch cho một nhóm cụ thể
 * GET /report/:chatId/:token
 */
router.get('/report/:chatId/:token', async (req, res) => {
  try {
    const { chatId, token } = req.params;
    
    // Verify token (simple security measure)
    const expectedToken = require('crypto')
      .createHash('md5')
      .update(`${chatId}_${process.env.TELEGRAM_BOT_TOKEN}`)
      .digest('hex')
      .substring(0, 16);
    
    if (token !== expectedToken) {
      return res.status(403).send('<h1>Access Denied</h1><p>Invalid token</p>');
    }
    
    // Tìm group
    const group = await Group.findOne({ chatId: chatId.toString() });
    if (!group) {
      return res.status(404).send('<h1>Group Not Found</h1><p>No data available for this group</p>');
    }
    
    // Lấy đơn vị tiền tệ
    const configCurrency = await Config.findOne({ key: `CURRENCY_UNIT_${chatId}` });
    const currencyUnit = configCurrency ? configCurrency.value : 'USDT';
    
    // Lấy format số của nhóm
    const numberFormat = await getGroupNumberFormat(chatId);
    
    // Lấy thông tin giao dịch từ lần clear cuối
    const lastClearDate = group.lastClearDate;
    
    // Lấy tất cả các giao dịch deposit/withdraw
    const depositTransactions = await Transaction.find({
      chatId: chatId.toString(),
      type: { $in: ['deposit', 'withdraw'] },
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: 1 });
    
    // Lấy tất cả các giao dịch payment
    const paymentTransactions = await Transaction.find({
      chatId: chatId.toString(),
      type: 'payment',
      timestamp: { $gt: lastClearDate },
      skipped: { $ne: true }
    }).sort({ timestamp: 1 });
    
    // Lấy thông tin thẻ
    const cards = await Card.find({ 
      chatId: chatId.toString(),
      hidden: { $ne: true }
    }).sort({ cardCode: 1 });
    
    // Format dữ liệu giao dịch deposit
    const depositEntries = depositTransactions.map((t, index) => ({
      id: index + 1,
      details: t.details,
      timestamp: t.timestamp,
      senderName: t.senderName || '',
      amount: t.amount || 0,
      usdtAmount: t.usdtAmount || 0,
      cardCode: t.cardCode || ''
    }));
    
    // Format dữ liệu giao dịch payment
    const paymentEntries = paymentTransactions.map((t, index) => ({
      id: index + 1,
      details: t.details,
      timestamp: t.timestamp,
      senderName: t.senderName || '',
      usdtAmount: t.usdtAmount || 0,
      cardCode: t.cardCode || ''
    }));
    
    // Tính tổng
    const totals = {
      totalVND: group.totalVND || 0,
      totalUSDT: group.totalUSDT || 0,
      usdtPaid: group.usdtPaid || 0,
      remainingUSDT: group.remainingUSDT || 0
    };
    
    // Tạo HTML response
    const html = generateReportHTML({
      chatId,
      group,
      depositEntries,
      paymentEntries,
      cards,
      totals,
      currencyUnit,
      numberFormat,
      lastClearDate
    });
    
    res.send(html);
    
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).send('<h1>Server Error</h1><p>Unable to generate report</p>');
  }
});

/**
 * Tạo HTML cho báo cáo
 */
function generateReportHTML(data) {
  const {
    chatId,
    group,
    depositEntries,
    paymentEntries,
    cards,
    totals,
    currencyUnit,
    numberFormat,
    lastClearDate
  } = data;
  
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>交易报告 - Group ${chatId}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .summary-card .value {
            font-size: 1.8em;
            font-weight: bold;
            color: #333;
            margin: 0;
        }
        
        .section {
            margin: 0;
            border-top: 1px solid #eee;
        }
        
        .section-header {
            background: #f8f9fa;
            padding: 20px 30px;
            border-bottom: 1px solid #eee;
        }
        
        .section-header h2 {
            margin: 0;
            color: #333;
            font-size: 1.5em;
        }
        
        .transactions {
            padding: 0;
        }
        
        .transaction-item {
            padding: 15px 30px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .transaction-item:last-child {
            border-bottom: none;
        }
        
        .transaction-item:hover {
            background-color: #f8f9fa;
        }
        
        .transaction-id {
            background: #e9ecef;
            color: #495057;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            min-width: 30px;
            text-align: center;
            margin-right: 15px;
        }
        
        .transaction-details {
            flex: 1;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            line-height: 1.4;
        }
        
        .transaction-meta {
            text-align: right;
            font-size: 0.8em;
            color: #666;
            min-width: 120px;
        }
        
        .card-section {
            padding: 20px 30px;
        }
        
        .card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .card-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        
        .card-code {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 8px;
        }
        
        .card-details {
            font-size: 0.9em;
            color: #666;
        }
        
        .no-data {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
            border-top: 1px solid #eee;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .header {
                padding: 20px;
            }
            
            .header h1 {
                font-size: 2em;
            }
            
            .summary {
                padding: 20px;
                gap: 15px;
            }
            
            .transaction-item {
                flex-direction: column;
                align-items: flex-start;
                padding: 20px;
            }
            
            .transaction-meta {
                margin-top: 10px;
                text-align: left;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 交易报告</h1>
            <p>Group ID: ${chatId} | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <h3>总入款 (VND)</h3>
                <p class="value">${formatSmart(totals.totalVND, numberFormat)}</p>
            </div>
            <div class="summary-card">
                <h3>总${currencyUnit}</h3>
                <p class="value">${formatSmart(totals.totalUSDT, numberFormat)}</p>
            </div>
            <div class="summary-card">
                <h3>已下发</h3>
                <p class="value">${formatSmart(totals.usdtPaid, numberFormat)}</p>
            </div>
            <div class="summary-card">
                <h3>未下发</h3>
                <p class="value">${formatSmart(totals.remainingUSDT, numberFormat)}</p>
            </div>
            <div class="summary-card">
                <h3>费率</h3>
                <p class="value">${group.rate || 0}%</p>
            </div>
            <div class="summary-card">
                <h3>汇率</h3>
                <p class="value">${formatSmart(group.exchangeRate || 0, numberFormat)}</p>
            </div>
        </div>
        
        <div class="section">
            <div class="section-header">
                <h2>💰 入款明细 (${depositEntries.length})</h2>
            </div>
            <div class="transactions">
                ${depositEntries.length > 0 ? depositEntries.map(entry => `
                    <div class="transaction-item">
                        <span class="transaction-id">${entry.id}</span>
                        <div class="transaction-details">${entry.details}</div>
                        <div class="transaction-meta">
                            <div>${entry.senderName}</div>
                            <div>${new Date(entry.timestamp).toLocaleString('zh-CN')}</div>
                        </div>
                    </div>
                `).join('') : '<div class="no-data">暂无入款记录</div>'}
            </div>
        </div>
        
        <div class="section">
            <div class="section-header">
                <h2>📤 下发明细 (${paymentEntries.length})</h2>
            </div>
            <div class="transactions">
                ${paymentEntries.length > 0 ? paymentEntries.map(entry => `
                    <div class="transaction-item">
                        <span class="transaction-id">!${entry.id}</span>
                        <div class="transaction-details">${entry.details}</div>
                        <div class="transaction-meta">
                            <div>${entry.senderName}</div>
                            <div>${new Date(entry.timestamp).toLocaleString('zh-CN')}</div>
                        </div>
                    </div>
                `).join('') : '<div class="no-data">暂无下发记录</div>'}
            </div>
        </div>
        
        ${cards.length > 0 ? `
        <div class="section">
            <div class="section-header">
                <h2>💳 卡片汇总 (${cards.length})</h2>
            </div>
            <div class="card-section">
                <div class="card-grid">
                    ${cards.map(card => `
                        <div class="card-item">
                            <div class="card-code">${card.cardCode}</div>
                            <div class="card-details">
                                总计: ${formatSmart(card.total, numberFormat)} VND<br>
                                已付: ${formatSmart(card.paid, numberFormat)} ${currencyUnit}<br>
                                ${card.limit > 0 ? `限额: ${formatSmart(card.limit, numberFormat)} VND<br>` : ''}
                                更新: ${new Date(card.lastUpdated).toLocaleString('zh-CN')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="footer">
            <p>上次清零: ${lastClearDate ? new Date(lastClearDate).toLocaleString('zh-CN') : '从未清零'}</p>
            <p>本报告由 Telegram Bot 自动生成</p>
        </div>
    </div>
</body>
</html>
  `;
}

module.exports = router; 