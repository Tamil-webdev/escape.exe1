const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const vm = require('vm');

// 1. Read puzzles.js and convert const to var so it attaches to context
let puzzlesCode = fs.readFileSync(path.join(__dirname, '../puzzles.js'), 'utf8');
puzzlesCode = puzzlesCode.replace(/const /g, 'var ');

// 2. Evaluate puzzles.js in a clean context to extract data
const context = {};
vm.createContext(context);
vm.runInContext(puzzlesCode, context);
const { ROUND1_PUZZLES, ROUND2_STAGES } = context;

// 3. Setup PDF
const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: false });
doc.pipe(fs.createWriteStream(path.join(__dirname, '../CODE_NOIR_Official_Answer_Key.pdf')));

// Headers & Footers
let pageNumber = 0;
doc.on('pageAdded', () => {
    pageNumber++;
    // Save current positions
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // Prevent infinite page adding

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#666666')
       .text('CODE//ESCAPE — CODE NOIR', 50, 30, { align: 'left', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#E63946')
       .text('CONFIDENTIAL — ORGANIZER USE ONLY', 50, doc.page.height - 40, { align: 'left', lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor('#666666')
       .text(`Page ${pageNumber}`, 50, doc.page.height - 40, { align: 'right', lineBreak: false });
       
    // Restore bottom margin
    doc.page.margins.bottom = oldBottom;
});

// Helper for pagination
function checkSpace(height) {
    if (doc.y + height > doc.page.height - 70) {
        doc.addPage();
    }
}

// ── COVER PAGE ──
doc.addPage();
doc.moveDown(8);
doc.font('Helvetica-Bold').fontSize(36).fillColor('#000000').text('CODE//ESCAPE', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(22).text('CODE NOIR — OFFICIAL ANSWER KEY', { align: 'center' });
doc.moveDown(1.5);
doc.fontSize(16).fillColor('#555555').text('Round 1 + Round 2', { align: 'center' });
doc.moveDown(6);
doc.fontSize(14).fillColor('#E63946').text('CONFIDENTIAL — ORGANIZER USE ONLY', { align: 'center' });

// ── ROUND 1 ──
doc.addPage();
doc.font('Helvetica-Bold').fontSize(24).fillColor('#000000').text('ROUND 1 — ANSWER KEY');
doc.moveDown(1);

ROUND1_PUZZLES.forEach((stage, idx) => {
    checkSpace(180);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000').text(`STAGE ${idx + 1}: ${stage.title}`);
    doc.moveDown(0.5);
    
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#555555').text('TYPE');
    doc.font('Helvetica').fontSize(12).fillColor('#000000').text('Python + SQL');
    doc.moveDown(0.5);
    
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#555555').text('PYTHON ANSWER / EXPECTED OUTPUT');
    doc.font('Courier-Bold').fontSize(12).fillColor('#000000').text(stage.expected_output, { lineGap: 2 });
    doc.moveDown(0.5);
    
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#555555').text('SQL ANSWER / EXPECTED RESULT');
    doc.font('Courier-Bold').fontSize(13).fillColor('#E63946').text(stage.correct_answer, { lineGap: 2 });
    doc.moveDown(1);
    
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).stroke('#cccccc');
    doc.moveDown(1);
});

// ── ROUND 2 ──
doc.addPage();
doc.font('Helvetica-Bold').fontSize(24).fillColor('#000000').text('ROUND 2 — ANSWER KEY');
doc.moveDown(1);

ROUND2_STAGES.forEach((stage, idx) => {
    checkSpace(200);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000').text(`STAGE ${idx + 1}: ${stage.title}`);
    doc.moveDown(0.5);
    
    let typeLabel = stage.type === 'python' ? 'Python' : (stage.type === 'sql' ? 'SQL' : 'Password/Cipher');
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#555555').text('TYPE');
    doc.font('Helvetica').fontSize(12).fillColor('#000000').text(typeLabel);
    doc.moveDown(0.5);
    
    if (stage.expected_output) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#555555').text('PYTHON ANSWER / EXPECTED OUTPUT');
        doc.font('Courier-Bold').fontSize(12).fillColor('#000000').text(stage.expected_output, { lineGap: 2 });
        doc.moveDown(0.5);
    }
    
    if (stage.result_value) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#555555').text('CORRECT ANSWER (FRAGMENT)');
        doc.font('Courier-Bold').fontSize(14).fillColor('#E63946').text(stage.result_value);
        doc.moveDown(0.5);
    }
    
    if (stage.correct_answer) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#555555').text('SQL ANSWER / EXPECTED RESULT');
        doc.font('Courier-Bold').fontSize(14).fillColor('#E63946').text(stage.correct_answer);
        doc.moveDown(0.5);
    }
    
    if (stage.escape_code) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#555555').text('ESCAPE CODE / PASSWORD');
        doc.font('Courier-Bold').fontSize(16).fillColor('#E63946').text(stage.escape_code);
        doc.moveDown(0.5);
    }
    
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).stroke('#cccccc');
    doc.moveDown(1);
});

doc.end();
console.log('PDF Generated Successfully!');
