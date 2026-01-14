
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve('.env.local');
        if (!fs.existsSync(envPath)) return {};
        const content = fs.readFileSync(envPath, 'utf8');
        const env = {};
        content.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // Remove quotes if present
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                env[key] = value;
            }
        });
        return env;
    } catch (e) {
        return {};
    }
}

async function verify() {
    console.log("1. Checking Environment Variables...");
    const env = loadEnv();
    const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const bucketName = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (!projectId) console.error("❌ Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    else console.log(`✅ Project ID: ${projectId}`);

    if (!bucketName) console.error("❌ Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
    else console.log(`✅ Bucket: ${bucketName}`);

    if (!projectId || !bucketName) return;

    console.log("\n2. Initializing Firebase Admin...");
    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: projectId,
                storageBucket: bucketName
            });
        }
        console.log("✅ Admin Initialized");
    } catch (e) {
        console.error("❌ Admin Init Failed:", e.message);
        console.error("   (Did you run 'gcloud auth application-default login'?)");
        return;
    }

    console.log("\n3. Testing Storage Access...");
    try {
        const bucket = getStorage().bucket(bucketName);
        // Try to get metadata first as it's lighter
        const [metadata] = await bucket.getMetadata();
        console.log("✅ Storage Connected! Bucket Location:", metadata.location);
    } catch (e) {
        console.error("❌ Storage Access Failed:", e.message);
        console.error("   (Check if your user has 'Storage Object Admin' or 'Firebase Admin' roles)");
    }
}

verify().catch(console.error);
