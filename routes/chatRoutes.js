const express = require('express');
const router = express.Router();
const { getChatHistory, sendMessage, markAsRead, deleteMessage, editMessage, clearChat } = require('../controllers/chatController');
const { checkUser } = require('../controllers/user/authController');
const { checkDriver } = require('../controllers/driver/authController');

router.post('/user/message', checkUser, sendMessage);
router.post('/user/read',checkUser, markAsRead);
router.delete('/user/message/:messageId',checkUser, deleteMessage);
router.patch('/user/message/:messageId',checkUser, editMessage);

router.get('/user/history',checkUser, getChatHistory);

router.post("/user/clear",checkUser,clearChat)

////////////////////////////////driver

router.post('/driver/message',checkDriver , sendMessage);
router.post('/driver/read',checkDriver, markAsRead);
router.delete('/driver/message/:messageId',checkDriver, deleteMessage);
router.patch('/driver/message/:messageId',checkDriver, editMessage);

router.get('/driver/history',checkDriver, getChatHistory);

router.post("/driver/clear",checkDriver,clearChat)

module.exports = router;