const FirebaseDB = (function () {
    'use strict';

    firebase.initializeApp({
        apiKey: 'AIzaSyDwKEPvBysuYmcpmLRRQ561oBrOAA4AGig',
        authDomain: 'green-paper.firebaseapp.com',
        databaseURL: 'https://green-paper.firebaseio.com',
        projectId: 'green-paper',
        storageBucket: 'green-paper.appspot.com',
        messagingSenderId: '667005563269',
        appId: '1:667005563269:web:88158811c0f8ca2a'
    });


    let db = firebase.firestore();
    return {
        set: function (collection, doc, data = {}) {
            db.collection(collection).doc(doc).set(data);
        },
        get: function (collection, doc) {
            let docRef = db.collection(collection).doc(doc);

            return docRef.get().then((doc) => {
                if (doc.exists) {
                    return doc.data();
                } else {
                    console.log('找不到文件: ' + doc);
                    return {};
                }
            }).catch((error) => {
                console.error('提取文件時出錯: ', error);
            });
        }
    }

})();