const admin = require('firebase-admin');

// Initialize the Firebase Admin SDK
const serviceAccount = require('./dynasty-user-8cacb-firebase-adminsdk-slkji-b1e1409997.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const sendNotification = async (registrationToken, title, body, data = {}) => {
    const message = {
        notification: { title, body },
        data,
        token: registrationToken,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', title);
        return response;
    } catch (error) {
        console.log('Error sending notification:', error);
    }
};

module.exports = sendNotification;
