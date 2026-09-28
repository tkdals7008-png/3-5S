const KR_OFFICIAL_HOLIDAY_ICS = 'https://calendar.google.com/calendar/ical/en.south_korea.official%23holiday%40group.v.calendar.google.com/public/basic.ics';

function koreanHolidayDates_() {
  var cache=CacheService.getScriptCache(), raw=cache.get('MM_KR_OFFICIAL_HOLIDAYS_V1');
  if(raw) return JSON.parse(raw);
  var response=UrlFetchApp.fetch(KR_OFFICIAL_HOLIDAY_ICS,{muteHttpExceptions:true});
  if(response.getResponseCode()!==200) throw Error('한국 공휴일 달력을 읽을 수 없습니다. 알림 발송을 중단합니다.');
  var text=response.getContentText(), dates={};
  text.split('BEGIN:VEVENT').slice(1).forEach(function(event){
    if(!/DESCRIPTION:Public holiday/i.test(event)) return;
    var match=event.match(/DTSTART;VALUE=DATE:(\d{4})(\d{2})(\d{2})/);
    if(match) dates[match[1]+'-'+match[2]+'-'+match[3]]=true;
  });
  if(Object.keys(dates).length<20) throw Error('한국 공휴일 달력 데이터가 비어 있습니다. 알림 발송을 중단합니다.');
  cache.put('MM_KR_OFFICIAL_HOLIDAYS_V1',JSON.stringify(dates),21600);
  return dates;
}

function autoMailWorkDate_(now) {
  var tz=Session.getScriptTimeZone()||'Asia/Seoul', monday=autoMailWeekKey_(now);
  var holidays=koreanHolidayDates_();
  for(var i=0;i<5;i++){
    var date=Utilities.formatDate(new Date(new Date(monday+'T12:00:00+09:00').getTime()+i*86400000),tz,'yyyy-MM-dd');
    if(!holidays[date]) return date;
  }
  throw Error('이번 주 평일 모두 공휴일입니다. 자동메일 일정을 확인해 주세요.');
}
