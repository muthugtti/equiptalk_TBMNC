
import { db } from "@/lib/firebase";
import { doc, setDoc, writeBatch, collection, getDocs, query, limit } from "firebase/firestore";

export async function seedAnalyticsData() {
    console.log("Seeding analytics data...");

    try {
        const summaryRef = doc(db, "analytics_summary", "dashboard");

        // Check if data exists first to avoid overwriting if not needed, 
        // or just overwrite for this "seed" action. We'll overwrite to ensure fresh placeholder data.

        // 1. Summary Stats
        await setDoc(summaryRef, {
            totalChats: 1204,
            totalChatsTrend: 5, // percentage
            newIssues: 86,
            newIssuesTrend: 2,
            resolvedIssues: 75,
            resolvedIssuesTrend: -1,
            avgRating: 4.2,
            avgRatingTrend: 0.1
        });

        // 2. Chat Volume (Mocking 30 days of data roughly matching the curve)
        // We'll just create a single document with an array for easier fetching for this chart
        const volumeRef = doc(db, "analytics_chat_volume", "current_period");
        const chatVolumeData = Array.from({ length: 30 }, (_, i) => ({
            date: `Day ${i + 1}`,
            current: Math.floor(Math.random() * 100) + 50, // Random values between 50-150
            previous: Math.floor(Math.random() * 100) + 40  // Random values between 40-140
        }));
        await setDoc(volumeRef, { data: chatVolumeData });

        // 3. Sentiment Data
        const sentimentRef = doc(db, "analytics_sentiment", "current");
        await setDoc(sentimentRef, {
            positive: 75, // percentages
            neutral: 15,
            negative: 10,
            totalRatings: 256
        });

        // 4. Recent Issues
        const issuesCollection = collection(db, "analytics_recent_issues");
        // Clear existing for clean seed (optional, but good for dev)
        const existingIssues = await getDocs(query(issuesCollection));
        const batch = writeBatch(db);
        existingIssues.forEach((doc) => batch.delete(doc.ref));

        const issues = [
            {
                issueId: "#8214",
                description: "Incorrect pressure readings",
                equipment: "Compressor C-101",
                timestamp: "2023-10-27 10:45 AM",
                status: "Pending"
            },
            {
                issueId: "#8213",
                description: "Agent provided wrong maintenance date",
                equipment: "Pump P-205",
                timestamp: "2023-10-27 09:12 AM",
                status: "Resolved"
            },
            {
                issueId: "#8211",
                description: "Cannot find documentation for HX-300",
                equipment: "Heat Exchanger HX-300",
                timestamp: "2023-10-26 03:20 PM",
                status: "Unresolved"
            }
        ];

        issues.forEach((issue) => {
            const newDocRef = doc(issuesCollection); // Auto-ID
            batch.set(newDocRef, issue);
        });

        await batch.commit();

        console.log("Analytics data seeded successfully!");
    } catch (error) {
        console.error("Error seeding analytics data:", error);
    }
}
