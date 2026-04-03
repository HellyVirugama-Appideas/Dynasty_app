// const twilio = require('twilio');

// /**
//  * Send OTP via SMS using Twilio
//  * @param {string} mobile - Phone number with country code (e.g., +919876543210)
//  * @param {string} otp - OTP code to send
//  * @returns {Promise}
//  */
// exports.sendOTP = async (mobile, otp) => {
//     try {
//         // Validate environment variables
//         if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
//             throw new Error('Twilio credentials not configured in .env file');
//         }

//         // Initialize Twilio client with SID and Auth Token (basic auth)
//         const client = twilio(
//             process.env.TWILIO_ACCOUNT_SID,
//             process.env.TWILIO_AUTH_TOKEN
//         );

//         // Send SMS
//         const message = await client.messages.create({
//             body: `Your Driver verification code is: ${otp}. Valid for 2 minutes. Do not share this code.`,
//             from: process.env.TWILIO_PHONE_NUMBER,
//             to: mobile
//         });

//         console.log(`✓ OTP sent to ${mobile} | Message SID: ${message.sid} | Status: ${message.status}`);
        
//         return {
//             success: true,
//             messageId: message.sid,
//             status: message.status
//         };

//     } catch (error) {
//         console.error('Twilio Error Details:', {
//             message: error.message,
//             code: error.code,
//             moreInfo: error.moreInfo,
//             status: error.status
//         });
        
//         // Re-throw with user-friendly message
//         throw new Error(`Failed to send OTP: ${error.message}`);
//     }
// };
/////////////////////////////////////////////

const twilio = require('twilio');

exports.sendOTP = async (mobile, otp) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        // Validate environment variables
        if (!accountSid || !authToken || !fromNumber) {
            throw new Error('SMS provider credentials not configured');
        }

        // Initialize client with basic auth (SID + Secret)
        const client = twilio(accountSid, authToken);

        // Send SMS
        const message = await client.messages.create({
            body: `Your verification code is: ${otp}. Valid for 2 minutes.`,
            from: fromNumber,
            to: mobile
        });

        console.log(`✓ SMS sent to ${mobile} | SID: ${message.sid}`);
        return {
            success: true,
            messageId: message.sid,
            status: message.status
        };

    } catch (error) {
        console.error('SMS Provider Error:', {
            message: error.message,
            code: error.code,
            moreInfo: error.moreInfo
        });
        
        throw new Error(`SMS delivery failed: ${error.message}`);
    }
};
