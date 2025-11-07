const admin = require('firebase-admin');

const Notification = require('../models/notificationModel');

// Initialize the Firebase Admin SDK
const serviceAccount = require('./dynasty-ud-firebase-adminsdk-fx1y8-13482b8643.json');
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

const sendOnlyNotification = async (registrationToken, data) => {
    const message = {
        notification: { title: data.title, body: data.body },
        token: registrationToken,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);

        return response;
    } catch (error) {
        console.log('Error sending notification:', error);
    }
};

const sendRideNotification = async (registrationToken, data) => {
    const { title, body, ...restData } = data;
    console.log(
        '================================================================'
    );
    console.log(JSON.stringify(restData));
    console.log(
        '================================================================'
    );

    const message = {
        notification: { title: title, body: body },
        // data: restData,
        data: {
            data: JSON.stringify(restData),
        },
        token: registrationToken,
    };

    try {
        // await Notification.create(data);

        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);

        return response;
    } catch (error) {
        console.log('Error sending notification:', error);
    }
};

module.exports = {
    sendNotification,
    sendOnlyNotification,
    sendRideNotification,
};
