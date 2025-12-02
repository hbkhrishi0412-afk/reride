// Quick test for PUT/DELETE endpoints
const testId = 1000; // Use an existing vehicle ID

async function testPut() {
    try {
        const response = await fetch(`http://localhost:3001/api/vehicles?id=${testId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: 600000 })
        });
        const data = await response.json();
        console.log('PUT Response Status:', response.status);
        console.log('PUT Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('PUT Error:', error.message);
    }
}

async function testDelete() {
    try {
        const response = await fetch(`http://localhost:3001/api/vehicles?id=${testId}`, {
            method: 'DELETE'
        });
        const data = await response.json();
        console.log('DELETE Response Status:', response.status);
        console.log('DELETE Response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('DELETE Error:', error.message);
    }
}

// Test
testPut().then(() => testDelete());








