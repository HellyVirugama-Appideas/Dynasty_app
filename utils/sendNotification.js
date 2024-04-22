const admin = require('firebase-admin');

const Notification = require('../models/notificationModel');

// Initialize the Firebase Admin SDK
const serviceAccount = require('./dynasty-ud-firebase-adminsdk-fx1y8-35d54a0036.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const sendNotification = async (registrationToken, data) => {
    const message = {
        notification: { title: data.title, body: data.body },
        token: registrationToken,
    };

    try {
        await Notification.create(data);

        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);

        return response;
    } catch (error) {
        console.log('Error sending notification:', error);
    }
};

const sendRideNotification = async (registrationToken, data, title, body) => {
    const message = {
        notification: { title: title, body: body },
        data: data,
        token: registrationToken,
    };

    try {
        await Notification.create(data);

        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);

        return response;
    } catch (error) {
        console.log('Error sending notification:', error);
    }
};

module.exports = { sendNotification, sendRideNotification };
