module.exports = (doc, req) => {
    const accepted = ['en', 'fr', 'ar'];
    let language = accepted.includes(req.headers['accept-language'])
        ? req.headers['accept-language']
        : 'en';
    const lang = doc[language];
    let spread = doc.toObject ? doc.toObject() : doc;
    const newDoc = { ...lang, ...spread };
    delete newDoc.en;
    delete newDoc.fr;
    delete newDoc.ar;
    return newDoc;
};
