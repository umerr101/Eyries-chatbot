const fs = require('fs');
const { extractPassportData } = require('./src/ocr/passport');
const { translateNames } = require('./src/translation/arabic');

async function testOCR(imagePath) {
  try {
    console.log(`[TEST] Reading image: ${imagePath}`);
    const buffer = fs.readFileSync(imagePath);
    
    // Simulate whatsapp-web.js MessageMedia object
    const mediaData = {
      mimetype: 'image/jpeg',
      data: buffer.toString('base64')
    };

    console.log('[TEST] Running OCR...');
    const data = await extractPassportData(mediaData);
    
    console.log('\n--- OCR Extracted Data ---');
    console.log(data);

    // Only translate if we successfully got a name
    if (data.firstName && data.firstName !== 'Not detected' && data.lastName && data.lastName !== 'Not detected') {
      console.log('\n[TEST] Translating to Arabic...');
      const { firstNameAr, lastNameAr } = await translateNames(data.firstName, data.lastName);
      console.log(`First Name (Ar): ${firstNameAr}`);
      console.log(`Last Name (Ar):  ${lastNameAr}`);
    } else {
      console.log('\n[TEST] Could not extract names clearly enough to translate.');
    }
  } catch (error) {
    console.error('[TEST ERROR]', error);
  }
}

// Get the path from the command line argument
const path = process.argv[2];
if (!path) {
  console.log('Please provide an image path.');
} else {
  testOCR(path);
}
