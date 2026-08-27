function testMailPermission2() {
  var cfg = getAdminSettings_();
  var active = (cfg.mails || []).filter(function(m){ return m && m.active !== false && String(m.email || '').trim(); });
  if (!active.length) throw new Error('활성 메일 수신자가 없습니다. 관리자 화면에서 메일 수신자를 저장해 주세요.');
  var target = String(active[0].email).trim();
  MailApp.sendEmail({
    to: target,
    subject: '[My Machine] 메일 권한 승인 테스트',
    body: 'My Machine 메일 발송 권한이 정상적으로 승인되었습니다. 이 메일이 도착하면 발송 기능이 정상입니다.',
    name: 'My Machine'
  });
  Logger.log('메일 권한 테스트 발송 완료');
}
