#!/usr/bin/env node

/**
 * Script to help restart the MongoDB API server
 * This will check for running processes and provide instructions
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function findServerProcess() {
    try {
        // Check for Node processes running the server
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
        const lines = stdout.split('\n').filter(line => line.includes('node.exe'));
        
        console.log('📋 Found Node.js processes:');
        lines.forEach(line => {
            if (line.trim()) {
                const parts = line.split(',');
                if (parts.length > 1) {
                    console.log(`   PID: ${parts[1].replace(/"/g, '')}`);
                }
            }
        });
        
        console.log('\n⚠️  To restart the server:');
        console.log('   1. Find the process running dev-api-server-mongodb.js');
        console.log('   2. Stop it (Ctrl+C in the terminal where it\'s running)');
        console.log('   3. Restart with: node dev-api-server-mongodb.js');
        console.log('\n   OR kill the process and restart:');
        console.log('   taskkill /F /IM node.exe  (⚠️  This kills ALL Node processes!)');
        console.log('   node dev-api-server-mongodb.js');
        
    } catch (error) {
        console.log('⚠️  Could not check for running processes');
        console.log('\n📝 To restart the server manually:');
        console.log('   1. Stop the current server (Ctrl+C)');
        console.log('   2. Run: node dev-api-server-mongodb.js');
    }
}

findServerProcess();

