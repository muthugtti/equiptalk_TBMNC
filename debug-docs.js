

const admin = require('firebase-admin');

// Initialize directly
// Initialize directly using ADC

async function init() {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(), // Use ADC
            projectId: 'equiptalk-317d8'
        });
    }
}


// Mock environment variables if needed
process.env.GOOGLE_CLOUD_PROJECT_ID = 'equiptalk-317d8';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'equiptalk-317d8.firebasestorage.app';

async function checkDocs() {
    try {
        await init();


        console.log("Checking 'equipment_docs_text' collection...");
        const snapshot = await admin.firestore().collection('equipment_docs_text').get();

        if (snapshot.empty) {
            console.log("No documents found in 'equipment_docs_text'. Text extraction has likely failed or hasn't run.");
        } else {
            console.log(`Found ${snapshot.size} documents:`);
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`- ID: ${doc.id}`);
                console.log(`  EquipmentID: ${data.equipmentId}`);
                console.log(`  FileName: ${data.fileName}`);
                console.log(`  Text Length: ${data.text ? data.text.length : 0} chars`);
                console.log(`  UploadedAt: ${data.uploadedAt}`);
            });
        }
    } catch (error) {
        console.error("Error checking docs:", error);
    }
}

checkDocs();
