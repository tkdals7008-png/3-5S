const IMAGE_FOLDER_ID = "15HrhhAZCC84fb-lzg1UhCc8kBU7kA-41";
const ITEM_CONFIG_SHEET = "점검항목";
const MACHINE_CONFIG_SHEET = "설비마스터";
const MAIL_CONFIG_SHEET = "메일수신자";

const DEFAULT_ITEM_NAMES = [
  "설비주위에 물건, 전선 정리는 되어 있는가?",
  "작업대는 정리가 되어 있는가?",
  "작업지도서 등 현장부착물 잘 되어 있는가?",
  "작업대는 작업하기 편하게 정돈 되어 있는가?",
  "설비 점검 및 주변청소는 잘 되어 있는가?",
  "바닥에 기름이나 물은 청소 되었는가?",
  "오일 누수 및 파손 될 결함은 없는가?",
  "각종 유류는 눈으로 보는 관리가 되고 있는가?",
  "작업자의 작업복 및 안전복장은 갖추었는가?",
  "게시물은 잘 관리되고 있는가?"
];

function doPost(e) {
  try {
    var d = JSON.parse(e && e.postData && e.postData.contents || "{}");

    if (d.action === "save_items") {
      saveItemSettings_(d.items || []);
      return jsonResponse({status:"success", items:getItemSettings_()});
    }

    if (d.action === "save_admin_settings") {
      saveAdminSettings_(d.machines || [], d.mails || []);
      return jsonResponse({status:"success", settings:getAdminSettings_()});
    }

    if (d.action === "save_all_settings") {
      saveAdminSettings_(d.machines || [], d.mails || []);
      saveItemSettings_(d.items || []);
      return jsonResponse({status:"success", settings:getAdminSettings_(), items:getItemSettings_()});
    }

    if (d.action === "send_report_email") {
      var rs = (Array.isArray(d.recipients) ? d.recipients : [])
        .map(String).map(function(x){ return x.trim(); }).filter(Boolean);
      if (!rs.length) return jsonResponse({status:"error", message:"메일 수신자가 없습니다."});
      MailApp.sendEmail({
        to: rs.join(","),
        subject: d.subject || "[My Machine] 3정5S 점검 결과",
        body: d.body || "My Machine 점검 결과입니다.",
        name: "My Machine"
      });
      return jsonResponse({status:"success", sentCount:rs.length});
    }

    var s = getDataSheet_();

    if (d.action === "delete_record") {
      s.deleteRow(Number(d.rowIndex));
      return jsonResponse({status:"success"});
    }

    if (d.action === "edit_record") {
      var r = Number(d.rowIndex);
      s.getRange(r,1).setValue(d.editDate || "");
      s.getRange(r,2).setValue(d.editInspector || "");
      s.getRange(r,3).setValue(d.editMachine || "");
      s.getRange(r,14).setValue(d.editIssue || "");
      s.getRange(r,21).setValue(d.editActionText || "");
      return jsonResponse({status:"success"});
    }

    if (d.action === "update_admin") {
      var ri = Number(d.rowIndex), u = "";
      if (d.actionPhoto && d.actionPhoto.base64) {
        u = savePhoto_(d.actionPhoto, "Action_" + ri + "_" + Date.now());
      }
      s.getRange(ri,21).setValue(d.actionText || "");
      if (u) s.getRange(ri,22).setValue(u);
      return jsonResponse({status:"success"});
    }

    var urls = [];
    (d.photos || []).forEach(function(p, i){
      if (p && p.base64) urls.push(savePhoto_(p, (d.inspectDate || "date") + "_" + (d.machineId || "machine") + "_photo" + (i+1)));
    });

    var imm = Number(d.immediateCount || 0);
    var req = Number(d.requestCount || 0);
    var done = Number(d.actionCompleteCount || imm);
    var detail = makeImprovementDetail(d);
    var reqNo = req > 0 ? createRequestNo(s) : "";
    var snap = d.itemNamesSnapshot || JSON.stringify(getItemSettings_());

    ensureHeaders_(s);
    s.appendRow([
      d.inspectDate || "", d.inspectorName || "", d.machineId || "",
      d.item1 || "", d.item2 || "", d.item3 || "", d.item4 || "", d.item5 || "",
      d.item6 || "", d.item7 || "", d.item8 || "", d.item9 || "", d.item10 || "",
      d.issueRemarks || "", urls.join(", "), imm, req, done, detail, reqNo, "", "", snap
    ]);
    return jsonResponse({status:"success", requestNo:reqNo});

  } catch (err) {
    return jsonResponse({status:"error", message:err.toString()});
  }
}

function doGet(e) {
  try {
    var a = e && e.parameter ? String(e.parameter.action || "") : "";
    if (a === "get_items") return jsonResponse({status:"success", items:getItemSettings_()});
    if (a === "get_admin_settings") return jsonResponse({status:"success", settings:getAdminSettings_()});
    if (a === "health") return jsonResponse({status:"success", api:"MyMachine", version:"V3"});

    var s = getDataSheet_();
    var v = s.getDataRange().getValues();
    var out = [];

    for (var i=1; i<v.length; i++) {
      var r = v[i];
      if (r[0] === "") continue;
      var o=0, x=0, app=0, it=[], xi=[];
      for (var j=3; j<=12; j++) {
        var z = r[j];
        it.push(z);
        if (z !== "N/A" && z !== "") app++;
        if (z === "O") o++;
        if (z === "X") { x++; xi.push((j-2) + "번"); }
      }
      var ds = r[0];
      if (r[0] instanceof Date) ds = Utilities.formatDate(r[0], Session.getScriptTimeZone(), "yyyy-MM-dd");
      out.push({
        rowIndex:i+1, date:ds, inspector:r[1], machine:r[2], score:o+" / "+x,
        applicableCount:app, xCount:x, xItems:xi.join(", "), items:it,
        issue:r[13] || "", photos:r[14] || "",
        immediateCount:Number(r[15] || 0), requestCount:Number(r[16] || 0), actionCompleteCount:Number(r[17] || 0),
        improvementDetail:r[18] || "", requestNo:r[19] || "", actionText:r[20] || "", actionPhoto:r[21] || "",
        itemNamesSnapshot:r[22] || ""
      });
    }
    return jsonResponse(out);
  } catch (err) {
    return jsonResponse({status:"error", message:err.toString()});
  }
}

function getDataSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var excluded = [ITEM_CONFIG_SHEET, MACHINE_CONFIG_SHEET, MAIL_CONFIG_SHEET];
  var sheets = ss.getSheets();
  for (var i=0; i<sheets.length; i++) {
    if (excluded.indexOf(sheets[i].getName()) === -1) return sheets[i];
  }
  throw Error("점검결과 시트를 찾을 수 없습니다.");
}

function ensureHeaders_(s) {
  var h = {16:"즉시개선건수",17:"개선요청건수",18:"조치완료건수",19:"개선상세",20:"개선요청번호",21:"관리자조치내용",22:"관리자조치사진",23:"점검항목스냅샷"};
  Object.keys(h).forEach(function(c){ if (!s.getRange(1,+c).getValue()) s.getRange(1,+c).setValue(h[c]); });
}

function itemSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s = ss.getSheetByName(ITEM_CONFIG_SHEET);
  if (!s) {
    s = ss.insertSheet(ITEM_CONFIG_SHEET);
    s.getRange(1,1,1,4).setValues([["번호","사용","점검내용","수정일"]]);
    s.getRange(2,1,10,4).setValues(DEFAULT_ITEM_NAMES.map(function(n,i){ return [i+1,"Y",n,new Date()]; }));
    s.setFrozenRows(1);
  }
  return s;
}

function getItemSettings_() {
  var v = itemSheet_().getRange(2,1,10,4).getValues();
  return DEFAULT_ITEM_NAMES.map(function(d,i){
    return {no:i+1, active:String((v[i]||[])[1]||"Y").toUpperCase()!=="N", name:String((v[i]||[])[2]||d).trim()||d};
  });
}

function saveItemSettings_(items) {
  if (!Array.isArray(items) || !items.length) throw Error("점검항목 데이터가 없습니다.");
  var n = DEFAULT_ITEM_NAMES.map(function(d,i){
    var x = items.find(function(v){ return Number(v.no) === i+1; }) || {};
    return {no:i+1, active:x.active!==false, name:String(x.name||d).trim()||d};
  });
  if (!n.some(function(x){ return x.active; })) throw Error("점검항목은 최소 1개 이상 사용해야 합니다.");
  var l = LockService.getScriptLock();
  l.waitLock(10000);
  try {
    itemSheet_().getRange(2,1,10,4).setValues(n.map(function(x){ return [x.no,x.active?"Y":"N",x.name,new Date()]; }));
  } finally { l.releaseLock(); }
}

function getAdminSettings_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ms = ss.getSheetByName(MACHINE_CONFIG_SHEET);
  var es = ss.getSheetByName(MAIL_CONFIG_SHEET);
  var machines = [], mails = [];

  if (ms && ms.getLastRow() >= 2) {
    var mv = ms.getRange(2,1,ms.getLastRow()-1,6).getValues();
    machines = mv.filter(function(r){ return String(r[1]||"").trim(); }).map(function(r){
      return {active:String(r[0]||"Y").toUpperCase()!=="N", machine:String(r[1]||"").trim(), maker:String(r[2]||"").trim(), ton:String(r[3]||"").trim(), team:String(r[4]||"").trim(), owner:String(r[5]||"").trim()};
    });
  }

  if (es && es.getLastRow() >= 2) {
    var ev = es.getRange(2,1,es.getLastRow()-1,3).getValues();
    mails = ev.filter(function(r){ return String(r[2]||"").trim(); }).map(function(r){
      return {active:String(r[0]||"Y").toUpperCase()!=="N", name:String(r[1]||"").trim(), email:String(r[2]||"").trim()};
    });
  }

  return {configured:!!((ms && ms.getLastRow()>=2) || (es && es.getLastRow()>=2)), machines:machines, mails:mails};
}

function saveAdminSettings_(machines, mails) {
  if (!Array.isArray(machines) || !Array.isArray(mails)) throw Error("관리자 설정 형식이 올바르지 않습니다.");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ms = ss.getSheetByName(MACHINE_CONFIG_SHEET) || ss.insertSheet(MACHINE_CONFIG_SHEET);
    ms.clearContents();
    ms.getRange(1,1,1,6).setValues([["사용","설비호기","메이커","톤수","담당팀","담당자"]]);
    if (machines.length) {
      var mrows = machines.filter(function(x){ return x && String(x.machine||"").trim(); }).map(function(x){
        return [x.active===false?"N":"Y", String(x.machine||"").trim(), String(x.maker||"").trim(), String(x.ton||"").trim(), String(x.team||"").trim(), String(x.owner||"").trim()];
      });
      if (mrows.length) ms.getRange(2,1,mrows.length,6).setValues(mrows);
    }
    ms.setFrozenRows(1);

    var es = ss.getSheetByName(MAIL_CONFIG_SHEET) || ss.insertSheet(MAIL_CONFIG_SHEET);
    es.clearContents();
    es.getRange(1,1,1,3).setValues([["사용","이름","메일"]]);
    if (mails.length) {
      var erows = mails.filter(function(x){ return x && String(x.email||"").trim(); }).map(function(x){
        return [x.active===false?"N":"Y", String(x.name||"").trim(), String(x.email||"").trim()];
      });
      if (erows.length) es.getRange(2,1,erows.length,3).setValues(erows);
    }
    es.setFrozenRows(1);
  } finally { lock.releaseLock(); }
}

function savePhoto_(p,n) {
  var f = DriveApp.getFolderById(IMAGE_FOLDER_ID);
  var b = Utilities.newBlob(Utilities.base64Decode(p.base64), p.mimeType || "image/jpeg", n);
  return f.createFile(b).getUrl();
}

function makeImprovementDetail(d) {
  if (d.improvementDetail) return d.improvementDetail;
  if (!d.itemActionsJson) return "";
  try {
    return JSON.parse(d.itemActionsJson).map(function(a){
      var t = a.type === "immediate" ? "즉시개선" : a.type === "request" ? "개선요청" : a.type || "";
      var s = (a.item || a.itemNo || a.no || "") + "번: " + t;
      if (a.priority) s += " (" + a.priority + ")";
      if (a.memo || a.text) s += " - " + (a.memo || a.text);
      return s;
    }).join("\n");
  } catch (e) { return d.itemActionsJson; }
}

function createRequestNo(s) {
  var l = LockService.getScriptLock();
  l.waitLock(10000);
  try {
    var y = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy");
    var last = s.getLastRow(), m = 0;
    if (last >= 2) s.getRange(2,20,last-1,1).getValues().forEach(function(r){
      var no = r[0];
      if (no && String(no).indexOf("MM-"+y+"-") === 0) {
        var n = Number(String(no).split("-")[2]);
        if (!isNaN(n) && n > m) m = n;
      }
    });
    return "MM-" + y + "-" + ("0000" + (m+1)).slice(-4);
  } finally { l.releaseLock(); }
}

function jsonResponse(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function testMailPermission() {
  var e = Session.getActiveUser().getEmail();
  if (!e) throw Error("로그인된 Google 계정 이메일을 확인할 수 없습니다.");
  MailApp.sendEmail({to:e, subject:"[My Machine] 메일 기능 테스트", body:"My Machine 메일 발송 기능이 정상적으로 연결되었습니다.", name:"My Machine"});
}
