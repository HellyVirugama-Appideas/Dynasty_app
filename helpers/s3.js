const S3 = require('aws-sdk/clients/s3');

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

// create S3 instance
const s3 = new S3({
    region,
    accessKeyId,
    secretAccessKey,
});

// upload a file
exports.uploadFile = function (file) {
    const uploadParams = {
        Bucket: bucketName,
        Body: file.buffer,
        ContentType: file.mimetype,
        Key: `${Date.now()}-${file.originalname}`,
    };

    return s3.upload(uploadParams).promise();
};

// upload audio a file
exports.uploadAudioFile = function (file) {
    return s3.upload(file).promise();
};

exports.deleteiFle = function (fileLocation) {
    const params = {
        Bucket: bucketName,
        Key: fileLocation,
    };

    return s3.deleteObject(params).promise();
};

// download a file
// exports.getFileStream = function (fileKey) {
//     const downloadParams = {
//         Key: fileKey,
//         Bucket: bucketName,
//     };

//     return s3.getObject(downloadParams).createReadStream();
// };
