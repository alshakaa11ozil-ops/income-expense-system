require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genai.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
});

async function test() {
    console.log('Testing API Key:', process.env.GEMINI_API_KEY?.slice(0, 20) + '...');
    console.log('Model:', process.env.GEMINI_MODEL);
    console.log('---');

    try {
        const result = await model.generateContent(
            'Return a JSON object with two fields: "status" (value: "working") and "sample_advice" (value: a one-sentence financial tip).'
        );
        const text = result.response.text();
        console.log('RAW RESPONSE:\n', text);
        const parsed = JSON.parse(text);
        console.log('\nPARSED OK:', JSON.stringify(parsed, null, 2));
        console.log('\n✅ API key is working and JSON parsing is correct!');
    } catch (e) {
        console.error('\n❌ FAILED:', e.message);
    }
}

test();
