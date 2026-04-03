const admin = require('firebase-admin');

const Notification = require('../models/notificationModel');

// Initialize the Firebase Admin SDK
// const serviceAccount = require('./dynasty-ud-firebase-adminsdk-fx1y8-13482b8643.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// At top of sendNotification.js – replace existing init

if (!admin.apps.length) {
    try {
        const serviceAccount = require('./dynasty-ud-firebase-adminsdk-fx1y8-233d8070a9.json'); 

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log('╔═══════════════════════════════════════════════╗');
        console.log('║     FIREBASE ADMIN SDK INITIALIZED OK        ║');
        console.log('║ Project ID:', serviceAccount.project_id, '               ║');
        console.log('╚═══════════════════════════════════════════════╝');
    } catch (err) {
        console.error('╔═══════════════════════════════════════════════╗');
        console.error('║   FIREBASE INIT FAILED – KEY PROBLEM          ║');
        console.error('║ Error:', err.message);
        console.error('╚═══════════════════════════════════════════════╝');
    }
}

// const sendNotification = async (registrationToken, data) => {
//     const message = {
//         notification: { title: data.title, body: data.body },
//         token: registrationToken,
//     };

//     try {
//         await Notification.create(data);

//         const response = await admin.messaging().send(message);
//         console.log('Successfully sent notification:', response);

//         return response;
//     } catch (error) {
//         console.log('Error sending notification:', error);
//     }
// };
const sendNotification = async (registrationToken, data) => {
    if (!registrationToken) {
        throw new Error('No registration token provided');
    }

    const { title, body, ...restData } = data;

    const message = {
        notification: { 
            title: title || 'Dynasty Notification', 
            body: body || 'You have an update' 
        },
        data: {
            data: JSON.stringify({
                ...restData,
                type: data.type || 'general',
                timestamp: data.timestamp || new Date().toISOString()
            })
        },
        token: registrationToken,
    };

    try {
        await Notification.create(data);

        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification → Message ID:', response);
        return response;
    } catch (error) {
        console.error('FCM send failed:', error.code || error.message);
        console.error('Full FCM error:', error);
        throw error;
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

// const sendRideNotification = async (registrationToken, data) => {
//     const { title, body, ...restData } = data;
//     console.log(
//         '================================================================'
//     );
//     console.log(JSON.stringify(restData));
//     console.log(
//         '================================================================'
//     );

//     const message = {
//         notification: { title: title, body: body },
//         // data: restData,
//         data: {
//             data: JSON.stringify(restData),
//         },
//         token: registrationToken,
//     };

//     try {
//         // await Notification.create(data);

//         const response = await admin.messaging().send(message);
//         console.log('Successfully sent notification:', response);

//         return response;
//     } catch (error) {
//         console.log('Error sending notification:', error);
//     }
// };

const sendRideNotification = async (registrationToken, data) => {
    if (!registrationToken) {
        console.warn('No FCM token → skipping ride notification');
        return;
    }

    const { title, body, ...restData } = data;

    console.log('Sending ride notification to token:', registrationToken.substring(0, 20) + '...');

    const message = {
        notification: { title, body },
        data: {
            data: JSON.stringify(restData),
        },
        token: registrationToken,
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Ride notification SUCCESS → messageId:', response);
        // await Notification.create(data); // uncomment when stable
        return response;
    } catch (error) {
        console.error('Ride FCM failed:');
        console.error('→ Code:', error.code);
        console.error('→ Message:', error.message);
        if (error.errorInfo) console.error('→ ErrorInfo:', error.errorInfo);
        throw error;
    }
};

module.exports = {
    sendNotification,
    sendOnlyNotification,
    sendRideNotification,
};

