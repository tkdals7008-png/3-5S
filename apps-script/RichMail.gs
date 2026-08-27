function sendRichReportEmail_(d) {
  var rs = (Array.isArray(d.recipients) ? d.recipients : [])
    .map(String)
    .map(function(x){ return x.trim(); })
    .filter(Boolean);

  if (!rs.length) {
    return jsonResponse({status:'error', message:'메일 수신자가 없습니다.'});
  }

  if (!d.reportImageBase64) {
    return jsonResponse({status:'error', message:'메일 본문용 보고서 이미지가 없습니다.'});
  }

  if (!d.reportPdfBase64) {
    return jsonResponse({status:'error', message:'첨부용 PDF 데이터가 없습니다.'});
  }

  var imageBytes = Utilities.base64Decode(String(d.reportImageBase64));
  var imageBlob = Utilities.newBlob(
    imageBytes,
    d.reportImageMimeType || 'image/jpeg',
    d.reportImageName || 'MyMachine_Report.jpg'
  );

  var pdfBytes = Utilities.base64Decode(String(d.reportPdfBase64));
  var pdfBlob = Utilities.newBlob(
    pdfBytes,
    'application/pdf',
    d.reportPdfName || 'MyMachine_Report.pdf'
  );

  var title = d.subject || '[My Machine] 3정5S 점검 결과';
  var htmlBody = [
    '<div style="font-family:Arial,Malgun Gothic,sans-serif;background:#f3f6fb;padding:18px;color:#172033">',
    '<div style="max-width:1100px;margin:0 auto;background:#ffffff;border:1px solid #d9e2ef;border-radius:14px;padding:18px">',
    '<div style="background:#123a66;color:#ffffff;border-radius:12px;padding:16px 18px;margin-bottom:14px">',
    '<div style="font-size:22px;font-weight:800">My Machine 자주보전 &amp; 개선관리 시스템</div>',
    '<div style="font-size:13px;opacity:.9;margin-top:5px">3정5S 점검 결과 보고서</div>',
    '</div>',
    '<p style="font-size:14px;line-height:1.7;margin:0 0 14px">관리자 화면의 최신 보고서를 아래 이미지로 표시합니다. 동일 보고서는 PDF 파일로도 첨부되어 있습니다.</p>',
    '<div style="border:1px solid #d9e2ef;border-radius:10px;overflow:hidden;background:#fff">',
    '<img src="cid:reportImage" alt="My Machine 보고서" style="display:block;width:100%;height:auto;border:0">',
    '</div>',
    '<p style="font-size:12px;color:#68798d;margin:14px 0 0">첨부파일: ' + escapeHtmlForMail_(d.reportPdfName || 'MyMachine_Report.pdf') + '</p>',
    '</div>',
    '</div>'
  ].join('');

  MailApp.sendEmail({
    to: rs.join(','),
    subject: title,
    body: d.body || 'My Machine 3정5S 점검 결과입니다. 메일 본문의 보고서 이미지와 첨부 PDF를 확인해 주세요.',
    htmlBody: htmlBody,
    inlineImages: { reportImage: imageBlob },
    attachments: [pdfBlob],
    name: 'My Machine'
  });

  return jsonResponse({
    status:'success',
    sentCount:rs.length,
    richMail:true,
    pdfAttached:true,
    inlineImage:true
  });
}

function escapeHtmlForMail_(v) {
  return String(v || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
